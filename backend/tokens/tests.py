from django.test import TestCase
from places.models import Place, Queue
from tokens.models import Token
from tokens.services import create_token


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
            queue=self.queue,
            service_date="2026-11-02",
            number=1,
            customer_name="Test Customer",
            status=Token.Status.WAITING,
        )

        self.assertEqual(token.number, 1)

        self.assertEqual(
            token.status,
            Token.Status.WAITING,
        )

    def test_token_numbers_increment(self):
        # Create the first token
        first = create_token(
            queue=self.queue,
            customer_name="Customer 1",
        )

        # Create the second token
        second = create_token(
            queue=self.queue,
            customer_name="Customer 2",
        )

        # Verify token numbers
        self.assertEqual(first.number, 1)
        self.assertEqual(second.number, 2)