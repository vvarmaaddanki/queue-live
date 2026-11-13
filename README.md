# Queue Live — Real-Time Queue Management

Queue Live is a full-stack queue management application for clinics, salons, tuition centres and other service businesses. Customers can join an open queue, receive a token number and follow their place in line. Staff can manage queues from a protected dashboard.

## Live application

| Service | URL |
|---|---|
| Customer and staff frontend | https://queue-live-frontend.onrender.com |
| Backend API | https://queue-live-backend.onrender.com |
| GitHub repository | https://github.com/vvarmaaddanki/queue-live |

> The live links point to the currently deployed version. Changes on the development branch are not live until they are reviewed, merged and deployed.

## Current features

### Customer
- View queues that are currently open.
- Join a queue with a name and optional mobile number.
- Receive a token number and a public-UUID tracking identifier.
- View waiting position and estimated waiting time.
- Track token status with WebSocket updates and automatic polling as a fallback.
- Cancel a token while it is still waiting.

### Business owners and staff
- Register a business and its first owner account from the staff dashboard.
- Create queues for the owner’s business and set the default service time.\n- Display a self-hosted QR code for each open queue so customers can scan and join.
- Sign in using JWT authentication.
- Staff can view and manage queues belonging only to their own business.
- View queues belonging to their own business.
- Open or close a queue.
- Export the current day's queue tokens as a CSV file.
- View the day's tokens and their status.
- Call the next waiting customer.
- Complete or skip a token.

### Access and data handling
- Staff queue actions check that the signed-in user belongs to the queue's business.
- Public queue discovery lists open queues; authenticated staff can view their own business's queues, including closed queues.
- Customer status and cancellation routes use a UUID rather than exposing the sequential database ID. Public owner registration and customer token generation are rate-limited to reduce automated abuse.
- Queue and token data are stored through Django models and migrations.

## Technology

| Area | Technology |
|---|---|
| Backend | Python, Django 6.1 |
| API and authentication | Django REST Framework, Simple JWT |
| Real-time updates | Django Channels, WebSockets, Redis |
| Frontend | React, TypeScript, Vite |
| Database | PostgreSQL in deployment; SQLite fallback for local development |
| Hosting | Render |
| CI | GitHub Actions |

## How it works

1. A customer opens the frontend and selects an open queue.
2. The frontend sends the customer's details to the Django API.
3. The backend creates a dated token for that queue.
4. The customer follows the token status using its public UUID.
5. Staff sign in and manage only queues linked to their business.
6. Queue events are sent through Django Channels; the customer page also polls periodically if a WebSocket connection is unavailable.

## Repository layout

```text
queue-live/
├── backend/
│   ├── config/       # Django settings, URL configuration and ASGI
│   ├── analytics/    # Health check, queue listing and queue status API
│   ├── places/       # Businesses, staff profiles and queues
│   ├── tokens/       # Token models, APIs, services and WebSocket consumer
│   ├── users/        # User app
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   └── pages/
│   ├── package.json
│   └── package-lock.json
├── DEPLOYMENT_SAFETY.md  # Migration and production upgrade safety checklist
└── .github/
    └── workflows/
        └── ci.yml
```

## Run locally

### Option A: Docker Compose (recommended)

Install Docker Desktop, then from the repository root run:

```bash
docker compose up --build
```

Open the frontend at `http://localhost:5173` and the backend health check at `http://localhost:8000/api/health/`. Compose starts PostgreSQL, Redis, Django/Daphne and the Nginx-served React frontend. The backend container applies migrations to the local Docker database on startup. These Compose credentials are for local development only; do not reuse them in production.

Stop the services with `Ctrl+C`, then run `docker compose down`. To also delete the local PostgreSQL volume and its data, run `docker compose down -v`.

### Option B: Run services manually

### Prerequisites

- Python version supported by the pinned Django release.
- Node.js 22 or later and npm.
- Redis for WebSocket messaging.
- PostgreSQL is recommended for production-like local testing. The backend falls back to SQLite when `DATABASE_URL` is not set.

### 1. Clone the repository

```bash
git clone https://github.com/vvarmaaddanki/queue-live.git
cd queue-live
```

### 2. Configure and start the backend

Open a terminal:

```bash
cd backend
python -m venv .venv
```

Activate the environment on Windows:

```powershell
.venv\\Scripts\\Activate.ps1
```

Or in Git Bash:

```bash
source .venv/Scripts/activate
```

Install dependencies:

```bash
python -m pip install -r requirements.txt
```

Set the required environment variables before starting Django. Example for Git Bash:

```bash
export DJANGO_SECRET_KEY="replace-with-a-long-random-secret"
export DEBUG="True"
export ALLOWED_HOSTS="localhost,127.0.0.1"
export CORS_ALLOWED_ORIGINS="http://localhost:5173"
export REDIS_URL="redis://127.0.0.1:6379/0"
```

If using PostgreSQL, also set `DATABASE_URL` to your database connection string. Do not commit real secrets or production database credentials.

Apply migrations and start the backend:

```bash
python manage.py migrate
python manage.py runserver
```

The backend will be available at `http://127.0.0.1:8000`.

### 3. Start the frontend

Open a second terminal:

```bash
cd frontend
npm ci
```

Create `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Start Vite:

```bash
npm run dev
```

Open `http://localhost:5173`.

### 4. Register a business and create its first queue

- Open the frontend and select **Staff Dashboard**.
- Choose **Register a Business** and enter an owner username, password and business details.
- Return to login and sign in with the new owner account.
- Use **Create a queue** in the dashboard to add the first queue and set its default service time.
- Additional staff accounts can be created by an administrator and linked to the correct business through Django admin.

## API reference

All paths below are relative to the backend origin.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/health/` | Public | Backend health check |
| GET | `/api/queues/` | Public / JWT | Public users see open queues; staff see their business queues |
| GET | `/api/queues/public/{queue_public_uuid}/qr/` | Public | Return an SVG QR code linking to the open queue join page |
| POST | `/api/auth/register/` | Public | Create a business and its first owner account |
| POST | `/api/auth/login/` | Public | Obtain JWT access and refresh tokens |
| POST | `/api/auth/refresh/` | Refresh token | Refresh an access token |
| POST | `/api/tokens/generate/` | Public | Create a customer token |
| GET | `/api/tokens/public/{public_uuid}/status/` | Public UUID | Read token status and waiting estimate |
| POST | `/api/tokens/public/{public_uuid}/cancel/` | Public UUID | Cancel a waiting token |
| GET | `/api/tokens/queues/{queue_uuid}/` | JWT + queue access | List today's tokens for a queue |
| GET | `/api/tokens/queues/{queue_uuid}/export/` | JWT + queue access | Download today's queue tokens as CSV |
| POST | `/api/tokens/queues/{queue_uuid}/call-next/` | JWT + queue access | Complete the current token and call the next waiting token |
| POST | `/api/tokens/{token_id}/complete/` | JWT + queue access | Mark a serving token as completed |
| POST | `/api/tokens/{token_id}/skip/` | JWT + queue access | Skip a waiting or serving token |
| POST | `/api/queues/create/` | Owner JWT | Create a queue for the owner’s business |
| POST | `/api/queues/{queue_uuid}/status/` | JWT + queue access | Open or close a queue |

The owner-registration request accepts `username`, `password`, `place_name`, `place_kind` and optional `email`. Queue creation accepts `name` and optional `default_minutes` (1–120). Token generation accepts `name`, `queue_id` and optional `phone`. Queue status changes accept JSON with a Boolean `is_open` value.

## Configuration reference

| Variable | Purpose |
|---|---|
| `DJANGO_SECRET_KEY` | Required Django secret key |
| `DEBUG` | Set to `False` in production |
| `ALLOWED_HOSTS` | Comma-separated backend hostnames |
| `DATABASE_URL` | Optional database URL; SQLite is used when omitted |
| `REDIS_URL` | Redis connection used by Django Channels |
| `CORS_ALLOWED_ORIGINS` | Comma-separated frontend origins |
| `VITE_API_BASE_URL` | Frontend backend origin, without the `/api` suffix |
| `VITE_APP_URL` | Optional public frontend origin used to display QR destination links |
| `FRONTEND_URL` | Backend setting used to encode the frontend origin into queue QR codes |

## Tests and build

Docker images and the Compose configuration are also checked by GitHub Actions. Build them locally with `docker compose build`.

Backend tests:

```bash
cd backend
python manage.py test
python manage.py makemigrations --check --dry-run
```

Frontend production build:

```bash
cd frontend
npm ci
npm run build
```

GitHub Actions is configured to run backend migration checks, backend tests and the frontend build for pull requests and branch pushes. Check the Actions tab for the latest run result; do not treat a commit as verified until the workflow passes.

## Deployment notes

Read [DEPLOYMENT_SAFETY.md](DEPLOYMENT_SAFETY.md) before any database upgrade or production release.

The production frontend and backend are hosted on Render. Configure the environment variables above in the Render services, use PostgreSQL and Redis for deployed data and real-time messaging, and set the frontend origin in `CORS_ALLOWED_ORIGINS`. Set `FRONTEND_URL` to the public frontend origin so QR codes contain the correct customer join link. Configure the Render static site to rewrite unknown paths to `/index.html`; otherwise opening or refreshing `/token/{public_uuid}` or `/join/{queue_public_uuid}` may return a 404.

**Production migration warning:** Do not run the current migration chain against the live database until the migration history and data have been checked against a fresh backup. The existing migration history removes legacy customer and queue fields; see [Deployment Safety](DEPLOYMENT_SAFETY.md). A passing CI run proves that a fresh test database can migrate, not that an existing production database will retain its data. A development-branch commit does not update the live application by itself.

## Planned work

The remaining Phase 1 priorities are:
- Complete a data-safe migration and staging upgrade rehearsal.
- Verify QR join, customer status, cancellation, CSV export and staff actions end to end on the staging stack.
- Finish production configuration and rollback checks.

The TV display, language switching, running-late option, one-active-token-per-phone rule, SMS/WhatsApp alerts and multiple staff accounts remain Phase 2 work. Do not start them until Phase 1 is verified.

SMS/WhatsApp notifications, online payments, AI chatbots and native mobile apps are not part of the current scope.

## Developer

**A V Varma**  
Python Full Stack Developer · Django · React · TypeScript

- GitHub: https://github.com/vvarmaaddanki
- LinkedIn: https://www.linkedin.com/in/vvarmaaddanki/
