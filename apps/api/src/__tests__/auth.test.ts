import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { testContext, cleanDatabase } from './setup.js';
import {
  createTestHotel,
  createAllPermissions,
  createTestRole,
  createTestUser,
  loginAs,
} from './helpers.js';

const { app, prisma, supertest } = testContext;

describe('POST /api/v1/auth/login', () => {
  let hotelId: string;
  let userEmail: string;
  let userPassword: string;

  beforeAll(async () => {
    await cleanDatabase();
    const hotel = await createTestHotel();
    hotelId = hotel.id;
    const perms = await createAllPermissions();
    const role = await createTestRole(hotelId, perms);
    const user = await createTestUser(hotelId, role.id);
    userEmail = user.email;
    userPassword = user.password;
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it('should return 200 with user + accessToken for valid credentials', async () => {
    const res = await supertest.post('/api/v1/auth/login').send({ email: userEmail, password: userPassword });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe(userEmail);
    expect(res.body.data.accessToken).toBeDefined();
    expect(typeof res.body.data.accessToken).toBe('string');
  });

  it('should set refreshToken httpOnly cookie', async () => {
    const res = await supertest.post('/api/v1/auth/login').send({ email: userEmail, password: userPassword });

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const refreshCookie = (cookies as unknown as string[]).find((c: string) => c.startsWith('refreshToken='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('Path=/api/v1/auth');
  });

  it('should return 401 for wrong password', async () => {
    const res = await supertest.post('/api/v1/auth/login').send({ email: userEmail, password: 'WrongPass123!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 401 for non-existent email', async () => {
    const res = await supertest.post('/api/v1/auth/login').send({ email: 'nobody@test.com', password: 'TestPass123!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should lock account after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await supertest.post('/api/v1/auth/login').send({ email: userEmail, password: 'WrongPass123!' });
    }

    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    expect(user).toBeDefined();
    expect(user!.failedAttempts).toBe(5);
    expect(user!.lockedUntil).toBeInstanceOf(Date);
    expect(user!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it('should reject login on locked account', async () => {
    const res = await supertest.post('/api/v1/auth/login').send({ email: userEmail, password: userPassword });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toContain('locked');
  });
});

describe('POST /api/v1/auth/refresh', () => {
  let refreshCookie: string;

  beforeAll(async () => {
    await cleanDatabase();
    const hotel = await createTestHotel();
    const perms = await createAllPermissions();
    const role = await createTestRole(hotel.id, perms);
    const user = await createTestUser(hotel.id, role.id);
    const loginResult = await loginAs(app, user.email, user.password);
    refreshCookie = loginResult.refreshCookie;
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it('should return new accessToken with valid refresh cookie', async () => {
    const res = await supertest.post('/api/v1/auth/refresh').set('Cookie', refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(typeof res.body.data.accessToken).toBe('string');

    const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
    const newRefresh = cookies?.find((c: string) => c.startsWith('refreshToken='));
    expect(newRefresh).toBeDefined();
  });

  it('should detect refresh token reuse (present same token twice — second should fail)', async () => {
    const res1 = await supertest.post('/api/v1/auth/refresh').set('Cookie', refreshCookie);
    expect(res1.status).toBe(200);

    const res2 = await supertest.post('/api/v1/auth/refresh').set('Cookie', refreshCookie);
    expect(res2.status).toBe(401);
    expect(res2.body.error.message).toContain('reuse');
  });

  it('should reject expired/invalid refresh token', async () => {
    const res = await supertest.post('/api/v1/auth/refresh').set('Cookie', 'refreshToken=invalidtoken123');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('POST /api/v1/auth/logout', () => {
  let refreshCookie: string;

  beforeAll(async () => {
    await cleanDatabase();
    const hotel = await createTestHotel();
    const perms = await createAllPermissions();
    const role = await createTestRole(hotel.id, perms);
    const user = await createTestUser(hotel.id, role.id);
    const loginResult = await loginAs(app, user.email, user.password);
    refreshCookie = loginResult.refreshCookie;
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it('should clear refresh cookie', async () => {
    const res = await supertest.post('/api/v1/auth/logout').set('Cookie', refreshCookie);

    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
    const cleared = cookies?.find((c: string) => c.startsWith('refreshToken='));
    expect(cleared).toBeDefined();

    const maxAgeMatch = cleared!.match(/Max-Age=(\d+)/);
    if (maxAgeMatch) {
      expect(parseInt(maxAgeMatch[1]!, 10)).toBe(0);
    } else {
      const expiresMatch = cleared!.match(/expires=([^;]+)/);
      if (expiresMatch) {
        expect(new Date(expiresMatch[1]!).getTime()).toBeLessThan(Date.now());
      }
    }
  });
});

describe('GET /api/v1/auth/me', () => {
  let accessToken: string;

  beforeAll(async () => {
    await cleanDatabase();
    const hotel = await createTestHotel();
    const perms = await createAllPermissions();
    const role = await createTestRole(hotel.id, perms);
    const user = await createTestUser(hotel.id, role.id);
    const loginResult = await loginAs(app, user.email, user.password);
    accessToken = loginResult.accessToken;
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it('should return current user with valid token', async () => {
    const res = await supertest.get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.email).toBeDefined();
  });

  it('should return 401 without token', async () => {
    const res = await supertest.get('/api/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
