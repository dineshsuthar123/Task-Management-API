import request from 'supertest';
import app from '../src/index';
import prisma from '../src/config/database';

describe('Auth API', () => {
  beforeAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test',
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /v1/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const response = await request(app)
        .post('/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Test@123',
          role: 'USER',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('userId');
      expect(typeof response.body.userId).toBe('string');
    });

    it('should return 409 when email already exists', async () => {
      const response = await request(app)
        .post('/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Test@123',
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('should return 400 with invalid email', async () => {
      const response = await request(app)
        .post('/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Test@123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 with short password', async () => {
      const response = await request(app)
        .post('/v1/auth/register')
        .send({
          email: 'test2@example.com',
          password: 'short',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test@123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
      expect(typeof response.body.token).toBe('string');
    });

    it('should return 401 with invalid credentials', async () => {
      const response = await request(app)
        .post('/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_FAILED');
    });

    it('should return 401 with non-existent user', async () => {
      const response = await request(app)
        .post('/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Test@123',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_FAILED');
    });
  });
});
