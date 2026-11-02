from django.test import TestCase
from places.models import Place, Queue
from tokens.models import Token


class TokenModelTest(TestCase):

    def setUp(self):
        self.place = Place.objects.create(
            name="Test Clinic",
            kind="clinic",
        )

        self.queue = Queue.objects.create(
            place=self.place,
            name="General Queue",
        )

    def test_queue_creation(self):
        self.assertEqual(
            self.queue.name,
            "General Queue"
        )

    def test_token_creation(self):
        token = Token.objects.create(
            queue=self.queue,
            service_date="2026-11-02",
            number=1,
            customer_name="Test Customer",
            status=Token.Status.WAITING,
        )

        self.assertEqual(token.number, 1)

        self.assertEqual(
            token.status,
            Token.Status.WAITING
        )
