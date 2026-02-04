import request from 'supertest';
import app from '../src/index';
import prisma from '../src/config/database';
import { Role } from '@prisma/client';

let userToken: string;
let adminToken: string;
let testTaskId: string;

describe('Task API', () => {
  beforeAll(async () => {
    // Login as regular user
    const userResponse = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'user@taskapp.com',
        password: 'User@123',
      });
    userToken = userResponse.body.token;

    // Login as admin
    const adminResponse = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'admin@taskapp.com',
        password: 'Admin@123',
      });
    adminToken = adminResponse.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /v1/tasks', () => {
    it('should create a task with valid data', async () => {
      const response = await request(app)
        .post('/v1/tasks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Test Task',
          description: 'Test Description',
          status: 'PENDING',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Test Task');
      testTaskId = response.body.id;
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/v1/tasks')
        .send({
          title: 'Test Task',
        });

      expect(response.status).toBe(401);
    });

    it('should return 400 with invalid data', async () => {
      const response = await request(app)
        .post('/v1/tasks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          description: 'Missing title',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /v1/tasks', () => {
    it('should get user tasks with pagination', async () => {
      const response = await request(app)
        .get('/v1/tasks?page=1&limit=10')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/v1/tasks');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /v1/tasks/:id', () => {
    it('should get a specific task', async () => {
      const response = await request(app)
        .get(`/v1/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testTaskId);
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .get('/v1/tasks/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /v1/tasks/:id', () => {
    it('should update a task', async () => {
      const response = await request(app)
        .put(`/v1/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Updated Task',
          status: 'IN_PROGRESS',
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Task');
      expect(response.body.status).toBe('IN_PROGRESS');
    });

    it('should return 400 with no update fields', async () => {
      const response = await request(app)
        .put(`/v1/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('GET /v1/tasks/all (Admin)', () => {
    it('should allow admin to get all tasks', async () => {
      const response = await request(app)
        .get('/v1/tasks/all?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });

    it('should deny regular user access', async () => {
      const response = await request(app)
        .get('/v1/tasks/all?page=1&limit=10')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('DELETE /v1/tasks/:id', () => {
    it('should delete a task', async () => {
      const response = await request(app)
        .delete(`/v1/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(204);
    });

    it('should return 404 for already deleted task', async () => {
      const response = await request(app)
        .delete(`/v1/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
    });
  });
});
