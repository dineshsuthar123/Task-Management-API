# Task Management API - Backend Developer (Intern) Assignment

A scalable REST API with JWT authentication, role-based access control, and a Next.js frontend for task management.

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- Git

### 1. Clone and Setup

```bash
git clone <repository-url>
cd Assignment
cp backend/.env.example backend/.env
```

### 2. Start with Docker Compose

```bash
docker-compose up -d
cd backend
npm install
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

The API will be available at `http://localhost:3000`
Swagger documentation at `http://localhost:3000/v1/docs`

### 3. Run Frontend (separate terminal)

```bash
cd frontend
npm install
npm run dev
```

Frontend available at `http://localhost:3001`

## 📦 Tech Stack

**Backend:**
- Node.js + TypeScript
- Express 5
- Prisma ORM + PostgreSQL
- JWT Authentication (bcrypt)
- Joi validation
- Winston logging
- Swagger UI documentation

**Frontend:**
- Next.js 15 + TypeScript
- Tailwind CSS
- React Hooks for state management

**DevOps:**
- Docker & Docker Compose
- Jest for testing
- GitHub Actions CI/CD

## 🏗️ Project Structure

```
Assignment/
├── backend/
│   ├── src/
│   │   ├── controllers/   # Request handlers
│   │   ├── services/      # Business logic
│   │   ├── middleware/    # Auth, validation, error handling
│   │   ├── routes/        # API routes
│   │   ├── config/        # Configuration (DB, logger, swagger)
│   │   └── utils/         # Helpers and validation schemas
│   ├── test/              # Jest unit tests
│   ├── prisma/            # Database schema and migrations
│   ├── logs/              # Application logs
│   └── .env.example       # Environment variables template
├── frontend/
│   ├── app/               # Next.js app router pages
│   ├── components/        # React components
│   └── lib/               # Utilities and API client
├── docker-compose.yml     # PostgreSQL container
├── README.md
└── SCALE.md              # Scaling documentation
```

## 🔑 Environment Variables

### Backend (.env)

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/taskdb?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRY="15m"
PORT=3000
NODE_ENV="development"
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📚 API Endpoints

### Authentication

**Register User**
```bash
curl -X POST http://localhost:3000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecureP@ss123",
    "role": "USER"
  }'
```

**Login**
```bash
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecureP@ss123"
  }'
```

### Tasks (Protected - Requires JWT Token)

**Create Task**
```bash
curl -X POST http://localhost:3000/v1/tasks \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Complete project documentation",
    "description": "Write comprehensive README",
    "status": "PENDING"
  }'
```

**Get User Tasks (Paginated)**
```bash
curl -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  "http://localhost:3000/v1/tasks?page=1&limit=10"
```

**Get Single Task**
```bash
curl -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  http://localhost:3000/v1/tasks/<TASK_ID>
```

**Update Task**
```bash
curl -X PUT http://localhost:3000/v1/tasks/<TASK_ID> \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated task title",
    "status": "IN_PROGRESS"
  }'
```

**Delete Task**
```bash
curl -X DELETE http://localhost:3000/v1/tasks/<TASK_ID> \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

**Get All Tasks (Admin Only)**
```bash
curl -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  "http://localhost:3000/v1/tasks/all?page=1&limit=10"
```

## 🧪 Testing

```bash
cd backend
npm test                # Run tests with coverage
npm run test:watch      # Watch mode
```

**Test Coverage:**
- Authentication (register, login, validation)
- Task CRUD operations
- Role-based access control
- Error handling

## 🔐 Security Features

✅ Password hashing with bcrypt (work factor 10)  
✅ JWT token authentication (configurable expiry)  
✅ Role-based access control (USER/ADMIN)  
✅ Input validation (Joi schemas)  
✅ SQL injection prevention (Prisma parameterized queries)  
✅ Rate limiting (configurable per-IP limits)  
✅ Security headers (Helmet)  
✅ CORS configuration  
✅ Centralized error handling

## 📊 Database Schema

**User Model:**
- id (UUID)
- email (unique)
- password (hashed)
- role (USER | ADMIN)
- timestamps

**Task Model:**
- id (UUID)
- title
- description (optional)
- status (PENDING | IN_PROGRESS | COMPLETED)
- userId (foreign key)
- timestamps

## 🔍 API Versioning

All endpoints are prefixed with `/v1/` for versioning support:
- `/v1/auth/*` - Authentication endpoints
- `/v1/tasks/*` - Task management endpoints
- `/v1/docs` - Swagger UI documentation

## 📖 API Documentation

Interactive API documentation available at:
**http://localhost:3000/v1/docs**

Alternative: `postman_collection.json` in repository root (if provided)

## 🛠️ Development

### Database Migrations

```bash
cd backend
npx prisma migrate dev --name <migration_name>
npx prisma generate
```

### Seed Database

```bash
npm run prisma:seed
```

**Default Credentials:**
- Admin: `admin@taskapp.com` / `Admin@123`
- User: `user@taskapp.com` / `User@123`

### Build for Production

```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
npm start
```

## 📝 Logging

Logs are written to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- Console output (development mode)

## 🚦 Health Check

```bash
curl http://localhost:3000/health
```

Response: `{"status":"ok","timestamp":"2026-02-04T17:00:00.000Z"}`

## 🐳 Docker Support

```bash
# Start PostgreSQL
docker-compose up -d

# Stop
docker-compose down

# View logs
docker-compose logs -f
```

## 🎯 Acceptance Criteria Status

✅ POST /v1/auth/register - User registration with password hashing  
✅ POST /v1/auth/login - JWT token generation  
✅ Role enforcement - Admin-only endpoints protected  
✅ CRUD endpoints - Full task management with pagination  
✅ Swagger UI - Available at /v1/docs  
✅ Unit tests - Comprehensive test suite  
✅ README - Complete documentation with curl examples  
✅ Frontend - Next.js app with auth and CRUD  
✅ SCALE.md - Scaling strategies documented  
✅ Docker - Containerized PostgreSQL

## 📧 Submission

**Subject:** <YOUR NAME> Backend Developer (Intern) Task

**Recipients:**
- joydip@primetrade.ai
- hello@primetrade.ai
- chetan@primetrade.ai
- sonika@primetrade.ai

**Include:**
- GitHub repository link
- This README
- Postman collection (optional)
- SCALE.md
- NOTES_FOR_REVIEWER.md

## 👤 Author

**Your Name**
- Email: your.email@example.com
- GitHub: @yourusername

## 📄 License

This project is created as part of a technical assignment.
