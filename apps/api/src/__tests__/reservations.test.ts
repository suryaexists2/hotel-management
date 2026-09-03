import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { testContext, cleanDatabase } from './setup.js';
import {
  createTestHotel,
  createAllPermissions,
  createTestRole,
  createTestUser,
  createTestGuest,
  createTestRoomType,
  createTestRoom,
  loginAs,
} from './helpers.js';

const { app, prisma, supertest } = testContext;

describe('POST /api/v1/reservations', () => {
  let accessToken: string;
  let hotelId: string;
  let guestId: string;
  let roomTypeId: string;

  beforeAll(async () => {
    await cleanDatabase();
    const hotel = await createTestHotel();
    hotelId = hotel.id;
    const perms = await createAllPermissions();
    const role = await createTestRole(hotelId, perms);
    const user = await createTestUser(hotelId, role.id);
    const login = await loginAs(app, user.email, user.password);
    accessToken = login.accessToken;
    guestId = (await createTestGuest(hotelId)).id;
    roomTypeId = (await createTestRoomType(hotelId)).id;
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it('should create a reservation when rooms are available', async () => {
    const res = await supertest
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        guestId,
        roomTypeId,
        checkInDate: '2026-09-01',
        checkOutDate: '2026-09-03',
        adults: 1,
        children: 0,
        source: 'DIRECT',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.confirmationNo).toBeDefined();
    expect(res.body.data.status).toBe('CONFIRMED');
    expect(res.body.data.guestId).toBe(guestId);
    expect(res.body.data.roomTypeId).toBe(roomTypeId);
  });

  it('should reject with 409 when no rooms available', async () => {
    const singleRoomType = await createTestRoomType(hotelId, { name: 'Single Only', baseRate: 150, maxOccupancy: 1 });
    await createTestRoom(hotelId, singleRoomType.id, { roomNumber: '999' });

    const res1 = await supertest
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        guestId,
        roomTypeId: singleRoomType.id,
        checkInDate: '2026-10-01',
        checkOutDate: '2026-10-03',
        adults: 1,
        children: 0,
      });
    expect(res1.status).toBe(201);

    const res2 = await supertest
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        guestId,
        roomTypeId: singleRoomType.id,
        checkInDate: '2026-10-01',
        checkOutDate: '2026-10-03',
        adults: 1,
        children: 0,
      });

    expect(res2.status).toBe(409);
    expect(res2.body.error.code).toBe('CONFLICT');
  });

  it('should return 400 for non-existent guest', async () => {
    const res = await supertest
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        guestId: 'non-existent-id',
        roomTypeId,
        checkInDate: '2026-11-01',
        checkOutDate: '2026-11-03',
        adults: 1,
        children: 0,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Concurrent booking (atomicity)', () => {
  let accessToken: string;
  let hotelId: string;
  let guestId: string;
  let roomTypeId: string;

  beforeAll(async () => {
    await cleanDatabase();
    const hotel = await createTestHotel();
    hotelId = hotel.id;
    const perms = await createAllPermissions();
    const role = await createTestRole(hotelId, perms);
    const user = await createTestUser(hotelId, role.id);
    const login = await loginAs(app, user.email, user.password);
    accessToken = login.accessToken;
    guestId = (await createTestGuest(hotelId)).id;
    roomTypeId = (await createTestRoomType(hotelId)).id;
    await createTestRoom(hotelId, roomTypeId, { roomNumber: '101' });
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it('should allow exactly 1 success and 2 conflicts when overbooking a single-room type', async () => {
    const payload = {
      guestId,
      roomTypeId,
      checkInDate: '2026-12-01',
      checkOutDate: '2026-12-03',
      adults: 1,
      children: 0,
    };

    const promises = Array.from({ length: 3 }, () =>
      supertest
        .post('/api/v1/reservations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(payload),
    );

    const results = await Promise.all(promises);

    const success = results.filter((r) => r.status === 201);
    const conflicts = results.filter((r) => r.status === 409);

    expect(success).toHaveLength(1);
    expect(conflicts).toHaveLength(2);
  });
});

describe('POST /api/v1/reservations/:id/check-in', () => {
  let accessToken: string;
  let hotelId: string;
  let guestId: string;
  let roomTypeId: string;
  let roomId: string;
  let reservationId: string;

  beforeAll(async () => {
    await cleanDatabase();
    const hotel = await createTestHotel();
    hotelId = hotel.id;
    const perms = await createAllPermissions();
    const role = await createTestRole(hotelId, perms);
    const user = await createTestUser(hotelId, role.id);
    const login = await loginAs(app, user.email, user.password);
    accessToken = login.accessToken;
    guestId = (await createTestGuest(hotelId)).id;
    roomTypeId = (await createTestRoomType(hotelId)).id;
    roomId = (await createTestRoom(hotelId, roomTypeId, { roomNumber: '102' })).id;

    const createRes = await supertest
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        guestId,
        roomTypeId,
        roomId,
        checkInDate: '2026-07-15',
        checkOutDate: '2026-07-17',
        adults: 1,
        children: 0,
      });

    reservationId = createRes.body.data.id;
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it('should check in a confirmed reservation', async () => {
    const res = await supertest
      .post(`/api/v1/reservations/${reservationId}/check-in`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CHECKED_IN');
    expect(res.body.data.checkedInAt).toBeDefined();
  });

  it('should set room status to OCCUPIED', async () => {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    expect(room).toBeDefined();
    expect(room!.status).toBe('OCCUPIED');
  });

  it('should reject double-check-in', async () => {
    const res = await supertest
      .post(`/api/v1/reservations/${reservationId}/check-in`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});

describe('POST /api/v1/reservations/:id/check-out', () => {
  let accessToken: string;
  let hotelId: string;
  let guestId: string;
  let roomTypeId: string;
  let roomId: string;
  let reservationId: string;

  beforeAll(async () => {
    await cleanDatabase();
    const hotel = await createTestHotel();
    hotelId = hotel.id;
    const perms = await createAllPermissions();
    const role = await createTestRole(hotelId, perms);
    const user = await createTestUser(hotelId, role.id);
    const login = await loginAs(app, user.email, user.password);
    accessToken = login.accessToken;
    guestId = (await createTestGuest(hotelId)).id;
    roomTypeId = (await createTestRoomType(hotelId)).id;
    roomId = (await createTestRoom(hotelId, roomTypeId, { roomNumber: '103' })).id;

    const createRes = await supertest
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        guestId,
        roomTypeId,
        roomId,
        checkInDate: '2026-07-20',
        checkOutDate: '2026-07-22',
        adults: 1,
        children: 0,
      });

    reservationId = createRes.body.data.id;

    await supertest
      .post(`/api/v1/reservations/${reservationId}/check-in`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it('should check out a checked-in reservation', async () => {
    const res = await supertest
      .post(`/api/v1/reservations/${reservationId}/check-out`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CHECKED_OUT');
    expect(res.body.data.checkedOutAt).toBeDefined();
  });

  it('should reject check-out with outstanding balance', async () => {
    const newGuest = await createTestGuest(hotelId);
    const newRoomType = await createTestRoomType(hotelId);
    const newRoom = await createTestRoom(hotelId, newRoomType.id, { roomNumber: '104' });

    const createRes = await supertest
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        guestId: newGuest.id,
        roomTypeId: newRoomType.id,
        checkInDate: '2026-07-25',
        checkOutDate: '2026-07-27',
        adults: 1,
        children: 0,
      });

    const newResId = createRes.body.data.id;

    await supertest
      .post(`/api/v1/reservations/${newResId}/check-in`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ roomId: newRoom.id });

    const checkOutRes = await supertest
      .post(`/api/v1/reservations/${newResId}/check-out`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(checkOutRes.status).toBe(409);
    expect(checkOutRes.body.error.code).toBe('CONFLICT');
  });
});
