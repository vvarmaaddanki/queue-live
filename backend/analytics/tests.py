from django.contrib.auth import get_user_model
from django.test import TestCase
from unittest.mock import patch
from rest_framework.test import APIClient

from places.models import Place, Queue, StaffProfile


class QueueManagementApiTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.place = Place.objects.create(name="Test Clinic", kind="clinic")
        self.other_place = Place.objects.create(name="Other Clinic", kind="clinic")
        self.open_queue = Queue.objects.create(place=self.place, name="Open queue")
        self.closed_queue = Queue.objects.create(
            place=self.place,
            name="Closed queue",
            is_open=False,
        )
        self.other_queue = Queue.objects.create(
            place=self.other_place,
            name="Other place queue",
        )
        self.owner = User.objects.create_user(
            username="owner",
            password="test-password",
        )
        StaffProfile.objects.create(
            user=self.owner,
            place=self.place,
            role=StaffProfile.Role.OWNER,
        )
        self.client = APIClient()

    def test_public_queue_list_only_shows_open_queues(self):
        response = self.client.get("/api/queues/")
        self.assertEqual(response.status_code, 200)
        queue_ids = {item["id"] for item in response.json()["queues"]}
        self.assertIn(str(self.open_queue.id), queue_ids)
        self.assertNotIn(str(self.closed_queue.id), queue_ids)
        self.assertIn(str(self.other_queue.id), queue_ids)

    def test_staff_queue_list_includes_closed_queues_for_own_place(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get("/api/queues/")
        self.assertEqual(response.status_code, 200)
        queue_ids = {item["id"] for item in response.json()["queues"]}
        self.assertIn(str(self.open_queue.id), queue_ids)
        self.assertIn(str(self.closed_queue.id), queue_ids)
        self.assertNotIn(str(self.other_queue.id), queue_ids)

    @patch("analytics.views.broadcast_queue_update")
    def test_owner_can_close_and_reopen_own_queue(self, broadcast):
        self.client.force_authenticate(self.owner)
        url = f"/api/queues/{self.open_queue.id}/status/"
        close_response = self.client.post(url, {"is_open": False}, format="json")
        self.assertEqual(close_response.status_code, 200)
        self.open_queue.refresh_from_db()
        self.assertFalse(self.open_queue.is_open)

        open_response = self.client.post(url, {"is_open": True}, format="json")
        self.assertEqual(open_response.status_code, 200)
        self.open_queue.refresh_from_db()
        self.assertTrue(self.open_queue.is_open)

    def test_staff_cannot_change_another_place_queue(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            f"/api/queues/{self.other_queue.id}/status/",
            {"is_open": False},
            format="json",
        )
        self.assertEqual(response.status_code, 403)


class OwnerRegistrationAndQueueCreationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_owner_registration_creates_business_and_owner_profile(self):
        response = self.client.post("/api/auth/register/", {
            "username": "new-owner",
            "email": "owner@example.com",
            "password": "StrongPassword!2026",
            "place_name": "New Clinic",
            "place_kind": "clinic",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        User = get_user_model()
        owner = User.objects.get(username="new-owner")
        self.assertTrue(owner.check_password("StrongPassword!2026"))
        self.assertEqual(owner.staff_profile.role, StaffProfile.Role.OWNER)
        self.assertEqual(owner.staff_profile.place.name, "New Clinic")

    def test_owner_registration_rejects_duplicate_username(self):
        User = get_user_model()
        User.objects.create_user(username="existing-owner", password="StrongPassword!2026")
        response = self.client.post("/api/auth/register/", {
            "username": "existing-owner",
            "email": "",
            "password": "StrongPassword!2026",
            "place_name": "Clinic",
            "place_kind": "clinic",
        }, format="json")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(Place.objects.count(), 0)

    def test_owner_can_create_queue_only_for_own_business(self):
        User = get_user_model()
        place = Place.objects.create(name="Owner Clinic", kind="clinic")
        owner = User.objects.create_user(username="queue-owner", password="StrongPassword!2026")
        StaffProfile.objects.create(user=owner, place=place, role=StaffProfile.Role.OWNER)
        self.client.force_authenticate(owner)
        response = self.client.post("/api/queues/create/", {
            "name": "General Consultation",
            "default_minutes": 8,
        }, format="json")
        self.assertEqual(response.status_code, 201)
        queue = Queue.objects.get(place=place)
        self.assertEqual(queue.name, "General Consultation")
        self.assertEqual(queue.default_minutes, 8)

    def test_staff_cannot_create_queue(self):
        User = get_user_model()
        place = Place.objects.create(name="Staff Clinic", kind="clinic")
        staff = User.objects.create_user(username="queue-staff", password="StrongPassword!2026")
        StaffProfile.objects.create(user=staff, place=place, role=StaffProfile.Role.STAFF)
        self.client.force_authenticate(staff)
        response = self.client.post("/api/queues/create/", {
            "name": "Not Allowed",
            "default_minutes": 10,
        }, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(Queue.objects.filter(place=place).count(), 0)
