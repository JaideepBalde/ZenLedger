import request from 'supertest';
import { app, UserModel } from '../server';
import mongoose from 'mongoose';

describe('Authentication API', () => {
  beforeAll(async () => {
    // Ensure we're using test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zenledger_test');
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear users collection
    await UserModel.deleteMany({});
  });

  describe('POST /api/auth/signup', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        familyId: 'testfamily',
        handle: 'testuser',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.userId).toBeDefined();
      expect(response.body.familyId).toBe(userData.familyId);
      expect(response.body.role).toBe('PARENT');
    });

    it('should reject invalid input', async () => {
      const invalidData = {
        familyId: 'a', // too short
        handle: 'tu', // too short
        password: '123' // too short
      };

      const response = await request(app)
        .post('/api/auth/signup')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should reject duplicate username', async () => {
      const userData = {
        familyId: 'testfamily',
        handle: 'testuser',
        password: 'password123'
      };

      // Create first user
      await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(200);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/auth/signup')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      const userData = {
        familyId: 'testfamily',
        handle: 'testuser',
        password: 'password123'
      };

      await request(app)
        .post('/api/auth/signup')
        .send(userData);
    });

    it('should login successfully with correct credentials', async () => {
      const loginData = {
        familyId: 'testfamily',
        handle: 'testuser',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.userId).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const loginData = {
        familyId: 'testfamily',
        handle: 'testuser',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid credentials');
    });
  });
});
