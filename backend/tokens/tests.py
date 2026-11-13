from django.test import TestCase
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
