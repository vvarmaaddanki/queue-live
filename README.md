# 🚀 Live Queue App – Real-Time Queue Management System

A full-stack real-time queue management application designed to help clinics, salons, tuition centres, and small businesses manage customer waiting lines efficiently.

The application allows customers to join a queue and track their token status, while staff can manage queues and monitor customer flow through a centralized dashboard.

## 🌟 Project Overview

Traditional queue management systems often rely on paper tokens and manual coordination, leading to long waiting times, overcrowding, and poor customer experiences.

**Live Queue App** aims to solve these problems through a digital queue management system that simplifies customer registration, token management, and queue monitoring.
Live Demo     	URL
Frontend : https://queue-live-frontend.onrender.com
Backend  : https://queue-live-backend.onrender.com
GitHub	 : https://github.com/vvarmaaddanki/queue-live

### 🎯 Key Objectives

- Reduce physical waiting and overcrowding.
- Simplify queue management for business owners and staff.
- Provide customers with token-based queue tracking.
- Build a scalable full-stack application.
- Demonstrate practical backend and frontend integration.

## ✨ Features

### Backend
- REST API development using Django REST Framework.
- Queue management and database operations.
- Queue model with business name, queue name, availability status, and default waiting time.
- Token management and database migrations.
- Structured backend applications for users, places, tokens, and analytics.

### Frontend
- React-based user interface.
- TypeScript for structured frontend development.
- Vite development environment.
- API integration with the Django backend.
- Queue dashboard displaying queue information.

### Core Application Capabilities
- View available queues.
- Display queue information.
- Manage queue-related data.
- Connect frontend components with backend APIs.

> Note: Add additional capabilities such as live WebSocket updates, JWT authentication, customer joining, and analytics here only after verifying that they are implemented and tested in the deployed version.

## 🛠️ Technology Stack

| Category | Technologies |
|---|---|
| Backend | Python, Django |
| API | Django REST Framework |
| Frontend | React.js, TypeScript |
| Build Tool | Vite |
| Database | PostgreSQL |
| Development Tools | Git, GitHub, Postman |
| API Testing | Postman |
| Deployment | [Render] |

## 🏗️ Project Architecture

The application follows a client-server architecture.

```text
             USER
               |
               v
       REACT FRONTEND
       (TypeScript + Vite)
               |
               |
          REST API
               |
               v
       DJANGO BACKEND
               |
               v
       DJANGO REST
        FRAMEWORK
               |
               v
          DATABASE
         PostgreSQL
```

### Application Workflow

1. The user opens the React frontend.
2. The frontend communicates with the Django backend through REST APIs.
3. Django processes incoming requests.
4. The backend interacts with the database.
5. The requested data is returned through the API.
6. React displays the updated information.

## 📂 Project Structure

```text
queue-live/
│
├── backend/
│   ├── config/
│   ├── users/
│   ├── places/
│   │   ├── models.py
│   │   ├── admin.py
│   │   └── ...
│   │
│   ├── tokens/
│   ├── analytics/
│   ├── manage.py
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Join.tsx
│   │   │   └── TokenStatus.tsx
│   │   ├── components/
│   │   └── ...
│   │
│   ├── package.json
│   └── vite.config.ts
│
└── README.md
```

*This is a simplified structure. Update it to match the actual folders and files in your repository.*

## ⚙️ Installation and Setup

Follow these steps to run the project locally.

### 1. Clone the Repository

```bash
https://github.com/vvarmaaddanki/queue-live.git
```

### 2. Navigate to the Project

```bash
cd queue-live
```

### 3. Backend Setup

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv venv
```

Activate it on Windows:

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run migrations:

```bash
python manage.py migrate
```

Start the Django development server:

```bash
python manage.py runserver
```

Backend URL:

```text
http://127.0.0.1:8000
```

### 4. Frontend Setup

Open another terminal:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the frontend:

```bash
npm run dev
```

Frontend URL:

```text
https://localhost:5173/
```

## 🔗 API Integration

The frontend communicates with the Django backend through REST APIs.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/queues/` | Retrieve queue information |

Additional endpoints should be documented here after they are implemented and verified.

## 🗄️ Database

The project uses PostgreSQL for structured data storage.

The Queue model includes:

- `place` – Associated business or location.
- `name` – Queue name.
- `is_open` – Queue availability.
- `default_minutes` – Default estimated waiting time.

Django models and migrations manage database structure and changes.

## 🧪 Testing

API endpoints can be tested using Postman.

Testing should cover:

- API response status codes.
- Database operations.
- Queue creation and retrieval.
- Frontend and backend communication.
- Error handling and validation.

## 🚀 Deployment

The application has been successfully deployed.

- Live Application: [ADD YOUR LIVE FRONTEND URL]
- Backend API: [ADD YOUR BACKEND URL]
- GitHub Repository: [ADD YOUR REPOSITORY URL]

## 🔮 Future Enhancements

The planned improvements, following the project roadmap, include:

- Real-time queue updates using Django Channels and WebSockets.
- Redis integration for real-time messaging.
- JWT-based authentication.
- Customer token generation and tracking.
- Queue cancellation and management.
- QR code-based queue joining.
- Queue analytics and reporting.
- Docker-based deployment.
- Automated testing and GitHub Actions.

## 🎓 What I Learned

Through this project, I gained practical experience in:

- Developing backend applications using Python and Django.
- Designing REST APIs using Django REST Framework.
- Building frontend applications using React and TypeScript.
- Connecting frontend applications with backend services.
- Working with relational databases.
- Managing code using Git and GitHub.
- Deploying a full-stack application.

## 👨‍💻 Developer

**A V Varma**

Python Full Stack Developer | Django | React | TypeScript | PostgreSQL

- GitHub: https://github.com/vvarmaaddanki
- LinkedIn: https://www.linkedin.com/in/vvarmaaddanki/

---

⭐ If you find this project interesting, consider giving the repository a star!

**Built with Python, Django, React, and TypeScript.**
