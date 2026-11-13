from datetime import date

from django.test import TestCase, Client
from rest_framework.test import APIClient
from unittest.mock import patch
from django.contrib.auth import get_user_model

from places.models import Place, Queue, StaffProfile
from tokens.models import Token
from tokens.services import create_token
from tokens.views import user_can_manage_queue


class TokenModelTest(TestCase):

    def setUp(self):
        # Create a test clinic
        self.place = Place.objects.create(
            name="Test Clinic",
            kind="clinic",
        )

        # Create a queue for the clinic
        self.queue = Queue.objects.create(
            place=self.place,
            name="General Queue",
        )

    def test_queue_creation(self):
        self.assertEqual(
            self.queue.name,
            "General Queue",
        )

    def test_token_creation(self):
        token = Token.objects.create(
            queue_id=self.queue.pk,
            service_date="2026-11-02",
            number=1,
            name="Test Customer",
        )

        self.assertEqual(
            token.number,
            1,
        )

        self.assertEqual(
            token.name,
            "Test Customer",
        )

    def test_token_numbers_increment(self):
        # Create the first token
        first = create_token(
            queue_id=self.queue.pk,
            name="Customer 1",
        )

        # Create the second token
        second = create_token(
            queue_id=self.queue.pk,
            name="Customer 2",
        )

        # Verify token numbers
        self.assertEqual(
            first.number,
            1,
        )

        self.assertEqual(
            second.number,
            2,
        )

    def test_token_creation_stores_customer_phone(self):
        token = create_token(
            queue_id=self.queue.pk,
            name="Customer with phone",
            phone="9876543210",
        )
        self.assertEqual(token.phone, "9876543210")

    @patch("tokens.services.timezone.localdate", side_effect=[date(2026, 11, 1), date(2026, 11, 2)])
    def test_token_number_resets_on_a_new_service_day(self, mocked_localdate):
        first_day_token = create_token(queue_id=self.queue.pk, name="Day one")
        next_day_token = create_token(queue_id=self.queue.pk, name="Day two")
        self.assertEqual(first_day_token.number, 1)
        self.assertEqual(next_day_token.number, 1)
        self.assertNotEqual(first_day_token.service_date, next_day_token.service_date)

    def test_closed_queue_rejects_token_creation(self):
        self.queue.is_open = False
        self.queue.save(update_fields=["is_open"])
        with self.assertRaisesMessage(ValueError, "This queue is currently closed"):
            create_token(queue_id=self.queue.pk, name="Late Customer")


class QueueStaffAccessTest(TestCase):
    def setUp(self):
        User = get_user_model()
        self.place = Place.objects.create(name="Clinic A", kind="clinic")
        self.other_place = Place.objects.create(name="Clinic B", kind="clinic")
        self.queue = Queue.objects.create(place=self.place, name="General")
        self.owner = User.objects.create_user(
            username="clinic-owner",
            password="test-password",
        )
        StaffProfile.objects.create(
            user=self.owner,
            place=self.place,
            role=StaffProfile.Role.OWNER,
        )
        self.other_staff = User.objects.create_user(
            username="other-staff",
            password="test-password",
        )
        StaffProfile.objects.create(
            user=self.other_staff,
            place=self.other_place,
            role=StaffProfile.Role.STAFF,
        )

    def test_owner_can_manage_queue_in_own_place(self):
        self.assertTrue(user_can_manage_queue(self.owner, self.queue))

    def test_staff_from_another_place_cannot_manage_queue(self):
        self.assertFalse(user_can_manage_queue(self.other_staff, self.queue))

    def test_superuser_can_manage_queue(self):
        User = get_user_model()
        admin = User.objects.create_superuser(
            username="site-admin",
            email="admin@example.com",
            password="test-password",
        )
        self.assertTrue(user_can_manage_queue(admin, self.queue))



class CustomerTokenCancellationTest(TestCase):
    def setUp(self):
        self.place = Place.objects.create(name="Cancellation Clinic", kind="clinic")
        self.queue = Queue.objects.create(place=self.place, name="General")
        self.token = create_token(
            queue_id=self.queue.pk,
            name="Customer",
            phone="9876543210",
        )
        self.client = Client()

    def test_customer_status_uses_public_uuid_not_database_id(self):
        response = self.client.get(
            f"/api/tokens/public/{self.token.public_id}/status/"
        )
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("token_id", response.json())
        self.assertEqual(response.json()["name"], "Customer")

    @patch("tokens.views.broadcast_queue_update")
    def test_customer_can_cancel_waiting_token(self, broadcast):
        response = self.client.post(
            f"/api/tokens/public/{self.token.public_id}/cancel/"
        )
        self.assertEqual(response.status_code, 200)
        self.token.refresh_from_db()
        self.assertEqual(self.token.status, Token.Status.CANCELLED)
        broadcast.assert_called_once()

    @patch("tokens.views.broadcast_queue_update")
    def test_customer_cannot_cancel_serving_token(self, broadcast):
        self.token.status = Token.Status.SERVING
        self.token.save(update_fields=["status"])
        response = self.client.post(
            f"/api/tokens/public/{self.token.public_id}/cancel/"
        )
        self.assertEqual(response.status_code, 409)
        self.token.refresh_from_db()
        self.assertEqual(self.token.status, Token.Status.SERVING)
        broadcast.assert_not_called()


class QueueCsvExportTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.place = Place.objects.create(name="Export Clinic", kind="clinic")
        self.queue = Queue.objects.create(place=self.place, name="General")
        self.owner = User.objects.create_user(
            username="export-owner",
            password="test-password",
        )
        StaffProfile.objects.create(
            user=self.owner,
            place=self.place,
            role=StaffProfile.Role.OWNER,
        )
        self.client = APIClient()

    def test_owner_can_export_today_queue_as_csv(self):
        token = create_token(
            queue_id=self.queue.pk,
            name="CSV Customer",
            phone="9876543210",
        )
        self.client.force_authenticate(self.owner)
        response = self.client.get(
            f"/api/tokens/queues/{self.queue.id}/export/"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/csv; charset=utf-8")
        self.assertIn("attachment;", response["Content-Disposition"])
        self.assertIn("CSV Customer", response.content.decode("utf-8-sig"))
        self.assertIn("9876543210", response.content.decode("utf-8-sig"))

    def test_anonymous_user_cannot_export_queue_csv(self):
        response = self.client.get(
            f"/api/tokens/queues/{self.queue.id}/export/"
        )
        self.assertIn(response.status_code, (401, 403))


class StaffTokenActionTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.place = Place.objects.create(name="Action Clinic", kind="clinic")
        self.other_place = Place.objects.create(name="Other Action Clinic", kind="clinic")
        self.queue = Queue.objects.create(place=self.place, name="General")
        self.owner = User.objects.create_user(username="action-owner", password="test-password")
        StaffProfile.objects.create(user=self.owner, place=self.place, role=StaffProfile.Role.OWNER)
        self.other_staff = User.objects.create_user(username="action-other", password="test-password")
        StaffProfile.objects.create(user=self.other_staff, place=self.other_place, role=StaffProfile.Role.OWNER)
        self.client = APIClient()

    @patch("tokens.views.broadcast_queue_update")
    def test_owner_can_complete_serving_token(self, broadcast):
        token = create_token(queue_id=self.queue.pk, name="Serving customer")
        token.status = Token.Status.SERVING
        token.save(update_fields=["status"])
        self.client.force_authenticate(self.owner)
        response = self.client.post(f"/api/tokens/{token.id}/complete/")
        self.assertEqual(response.status_code, 200)
        token.refresh_from_db()
        self.assertEqual(token.status, Token.Status.DONE)
        self.assertIsNotNone(token.finished_at)
        broadcast.assert_called_once()

    @patch("tokens.views.broadcast_queue_update")
    def test_owner_can_skip_waiting_token(self, broadcast):
        token = create_token(queue_id=self.queue.pk, name="Waiting customer")
        self.client.force_authenticate(self.owner)
        response = self.client.post(f"/api/tokens/{token.id}/skip/")
        self.assertEqual(response.status_code, 200)
        token.refresh_from_db()
        self.assertEqual(token.status, Token.Status.SKIPPED)
        broadcast.assert_called_once()

    def test_other_business_owner_cannot_complete_token(self):
        token = create_token(queue_id=self.queue.pk, name="Private customer")
        token.status = Token.Status.SERVING
        token.save(update_fields=["status"])
        self.client.force_authenticate(self.other_staff)
        response = self.client.post(f"/api/tokens/{token.id}/complete/")
        self.assertEqual(response.status_code, 403)
        token.refresh_from_db()
        self.assertEqual(token.status, Token.Status.SERVING)

    def test_completed_token_cannot_be_skipped_again(self):
        token = create_token(queue_id=self.queue.pk, name="Completed customer")
        token.status = Token.Status.DONE
        token.save(update_fields=["status"])
        self.client.force_authenticate(self.owner)
        response = self.client.post(f"/api/tokens/{token.id}/skip/")
        self.assertEqual(response.status_code, 409)
        token.refresh_from_db()
        self.assertEqual(token.status, Token.Status.DONE)


class PublicTokenGenerationApiTests(TestCase):
    def setUp(self):
        self.place = Place.objects.create(name="Public API Clinic", kind="clinic")
        self.queue = Queue.objects.create(place=self.place, name="General")
        self.client = APIClient()

    def test_customer_can_create_token_with_valid_details(self):
        response = self.client.post("/api/tokens/generate/", {
            "name": "API Customer",
            "phone": "9876543210",
            "queue_id": str(self.queue.id),
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json().get("public_id"))
        token = Token.objects.get(public_id=response.json()["public_id"])
        self.assertEqual(token.name, "API Customer")
        self.assertEqual(token.phone, "9876543210")

    def test_token_generation_rejects_invalid_phone(self):
        response = self.client.post("/api/tokens/generate/", {
            "name": "Invalid Phone",
            "phone": "123",
            "queue_id": str(self.queue.id),
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Token.objects.count(), 0)

    def test_token_generation_rejects_closed_queue(self):
        self.queue.is_open = False
        self.queue.save(update_fields=["is_open"])
        response = self.client.post("/api/tokens/generate/", {
            "name": "Closed Queue Customer",
            "queue_id": str(self.queue.id),
        }, format="json")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(Token.objects.count(), 0)
