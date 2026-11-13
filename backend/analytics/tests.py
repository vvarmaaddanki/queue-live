from django.contrib.auth import get_user_model
from django.test import TestCase
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
        self.assertNotIn(str(self.other_queue.id), queue_ids)

    def test_staff_queue_list_includes_closed_queues_for_own_place(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get("/api/queues/")
        self.assertEqual(response.status_code, 200)
        queue_ids = {item["id"] for item in response.json()["queues"]}
        self.assertIn(str(self.open_queue.id), queue_ids)
        self.assertIn(str(self.closed_queue.id), queue_ids)
        self.assertNotIn(str(self.other_queue.id), queue_ids)

    def test_owner_can_close_and_reopen_own_queue(self):
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
