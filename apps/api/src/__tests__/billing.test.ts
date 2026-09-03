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

describe('Folio lifecycle', () => {
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
    roomTypeId = (await createTestRoomType(hotelId, { baseRate: 250 })).id;
    roomId = (await createTestRoom(hotelId, roomTypeId, { roomNumber: '201' })).id;

    const createRes = await supertest
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        guestId,
        roomTypeId,
        roomId,
        checkInDate: '2026-08-01',
        checkOutDate: '2026-08-04',
        adults: 1,
        children: 0,
      });

    reservationId = createRes.body.data.id;
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it('should create a folio on check-in', async () => {
    await supertest
      .post(`/api/v1/reservations/${reservationId}/check-in`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    const folioRes = await supertest
      .get(`/api/v1/billing/reservations/${reservationId}/folio`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(folioRes.status).toBe(200);
    expect(folioRes.body.data).toBeDefined();
    expect(folioRes.body.data.folioNumber).toBeDefined();
    expect(folioRes.body.data.status).toBe('OPEN');
    expect(folioRes.body.data.reservationId).toBe(reservationId);
  });

  it('should have ROOM charge posted automatically', async () => {
    const folioRes = await supertest
      .get(`/api/v1/billing/reservations/${reservationId}/folio`)
      .set('Authorization', `Bearer ${accessToken}`);

    const folio = folioRes.body.data;
    expect(folio.charges).toBeDefined();
    const roomCharge = folio.charges.find((c: { category: string }) => c.category === 'ROOM');
    expect(roomCharge).toBeDefined();
    expect(roomCharge.description).toContain('Room charge');

    const expectedRoomTotal = 250 * 3;
    expect(parseFloat(folio.totalCharges)).toBeCloseTo(expectedRoomTotal, 1);
  });
});

describe('Post charges', () => {
  let accessToken: string;
  let hotelId: string;
  let folioId: string;

  beforeAll(async () => {
    await cleanDatabase();
    const hotel = await createTestHotel();
    hotelId = hotel.id;
    const perms = await createAllPermissions();
    const role = await createTestRole(hotelId, perms);
    const user = await createTestUser(hotelId, role.id);
    const login = await loginAs(app, user.email, user.password);
    accessToken = login.accessToken;
    const guestId = (await createTestGuest(hotelId)).id;
    const roomTypeId = (await createTestRoomType(hotelId, { baseRate: 200 })).id;
    const roomId = (await createTestRoom(hotelId, roomTypeId, { roomNumber: '202' })).id;

    const createRes = await supertest
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        guestId,
        roomTypeId,
        roomId,
        checkInDate: '2026-08-10',
        checkOutDate: '2026-08-12',
        adults: 1,
        children: 0,
      });

    const resId = createRes.body.data.id;

    await supertest
      .post(`/api/v1/reservations/${resId}/check-in`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    const folioRes = await supertest
      .get(`/api/v1/billing/reservations/${resId}/folio`)
      .set('Authorization', `Bearer ${accessToken}`);

    folioId = folioRes.body.data.id;
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it('should add a charge and update balance', async () => {
    const chargeRes = await supertest
      .post(`/api/v1/billing/folios/${folioId}/charges`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        category: 'RESTAURANT',
        description: 'Dinner - Steak & Wine',
        unitPrice: 75,
        quantity: 1,
        taxAmount: 7.5,
      });

    expect(chargeRes.status).toBe(201);
    expect(parseFloat(chargeRes.body.data.balance)).toBeGreaterThan(0);

    const charge = chargeRes.body.data.charges.find(
      (c: { description: string }) => c.description === 'Dinner - Steak & Wine',
    );
    expect(charge).toBeDefined();
    expect(charge.category).toBe('RESTAURANT');
  });

  it('should reject posting to a non-existent folio', async () => {
    const res = await supertest
      .post('/api/v1/billing/folios/non-existent-id/charges')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        category: 'RESTAURANT',
        description: 'Test charge',
        unitPrice: 10,
        quantity: 1,
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('Record payment', () => {
  let accessToken: string;
  let hotelId: string;
  let folioId: string;

  beforeAll(async () => {
    await cleanDatabase();
    const hotel = await createTestHotel();
    hotelId = hotel.id;
    const perms = await createAllPermissions();
    const role = await createTestRole(hotelId, perms);
    const user = await createTestUser(hotelId, role.id);
    const login = await loginAs(app, user.email, user.password);
    accessToken = login.accessToken;
    const guestId = (await createTestGuest(hotelId)).id;
    const roomTypeId = (await createTestRoomType(hotelId, { baseRate: 200 })).id;
    const roomId = (await createTestRoom(hotelId, roomTypeId, { roomNumber: '203' })).id;

    const createRes = await supertest
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        guestId,
        roomTypeId,
        roomId,
        checkInDate: '2026-08-15',
        checkOutDate: '2026-08-17',
        adults: 1,
        children: 0,
      });

    const resId = createRes.body.data.id;

    await supertest
      .post(`/api/v1/reservations/${resId}/check-in`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    const folioRes = await supertest
      .get(`/api/v1/billing/reservations/${resId}/folio`)
      .set('Authorization', `Bearer ${accessToken}`);

    folioId = folioRes.body.data.id;
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it('should reduce balance after payment', async () => {
    const folioBefore = await supertest
      .get(`/api/v1/billing/folios/${folioId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    const balanceBefore = parseFloat(folioBefore.body.data.balance);

    const payRes = await supertest
      .post(`/api/v1/billing/folios/${folioId}/payments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        amount: balanceBefore,
        method: 'CREDIT_CARD',
        notes: 'Full payment',
      });

    expect(payRes.status).toBe(201);
    expect(parseFloat(payRes.body.data.balance)).toBeLessThanOrEqual(0.01);
    expect(payRes.body.data.totalPayments).toBeDefined();
  });

  it('should reject negative/zero payment', async () => {
    const res1 = await supertest
      .post(`/api/v1/billing/folios/${folioId}/payments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        amount: 0,
        method: 'CASH',
      });

    expect(res1.status).toBe(400);

    const res2 = await supertest
      .post(`/api/v1/billing/folios/${folioId}/payments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        amount: -50,
        method: 'CASH',
      });

    expect(res2.status).toBe(400);
  });
});

describe('Generate invoice', () => {
  let accessToken: string;
  let hotelId: string;
  let folioId: string;

  beforeAll(async () => {
    await cleanDatabase();
    const hotel = await createTestHotel();
    hotelId = hotel.id;
    const perms = await createAllPermissions();
    const role = await createTestRole(hotelId, perms);
    const user = await createTestUser(hotelId, role.id);
    const login = await loginAs(app, user.email, user.password);
    accessToken = login.accessToken;
    const guestId = (await createTestGuest(hotelId)).id;
    const roomTypeId = (await createTestRoomType(hotelId, { baseRate: 200 })).id;
    const roomId = (await createTestRoom(hotelId, roomTypeId, { roomNumber: '204' })).id;

    const createRes = await supertest
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        guestId,
        roomTypeId,
        roomId,
        checkInDate: '2026-08-20',
        checkOutDate: '2026-08-22',
        adults: 1,
        children: 0,
      });

    const resId = createRes.body.data.id;

    await supertest
      .post(`/api/v1/reservations/${resId}/check-in`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    const folioRes = await supertest
      .get(`/api/v1/billing/reservations/${resId}/folio`)
      .set('Authorization', `Bearer ${accessToken}`);

    folioId = folioRes.body.data.id;

    const balance = parseFloat(folioRes.body.data.balance);
    await supertest
      .post(`/api/v1/billing/folios/${folioId}/payments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        amount: balance,
        method: 'CREDIT_CARD',
      });
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it('should create an invoice for a settled folio', async () => {
    const invRes = await supertest
      .post(`/api/v1/billing/folios/${folioId}/invoice`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(invRes.status).toBe(201);
    expect(invRes.body.data.invoiceNumber).toBeDefined();
    expect(invRes.body.data.grandTotal).toBeDefined();
    expect(invRes.body.data.lineItems).toBeInstanceOf(Array);
  });

  it('should be idempotent (second call returns same invoice)', async () => {
    const invRes1 = await supertest
      .post(`/api/v1/billing/folios/${folioId}/invoice`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(invRes1.status).toBe(201);

    const invRes2 = await supertest
      .post(`/api/v1/billing/folios/${folioId}/invoice`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(invRes2.status).toBe(201);
    expect(invRes2.body.data.id).toBe(invRes1.body.data.id);
    expect(invRes2.body.data.invoiceNumber).toBe(invRes1.body.data.invoiceNumber);
  });
});

describe('Full billing flow', () => {
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
    roomTypeId = (await createTestRoomType(hotelId, { baseRate: 300 })).id;
    roomId = (await createTestRoom(hotelId, roomTypeId, { roomNumber: '205' })).id;

    const createRes = await supertest
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        guestId,
        roomTypeId,
        roomId,
        checkInDate: '2026-09-01',
        checkOutDate: '2026-09-04',
        adults: 2,
        children: 0,
      });

    reservationId = createRes.body.data.id;
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  it('should complete the full billing lifecycle: check in → post charge → pay → check out', async () => {
    const ciRes = await supertest
      .post(`/api/v1/reservations/${reservationId}/check-in`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(ciRes.status).toBe(200);
    expect(ciRes.body.data.status).toBe('CHECKED_IN');

    const folioRes1 = await supertest
      .get(`/api/v1/billing/reservations/${reservationId}/folio`)
      .set('Authorization', `Bearer ${accessToken}`);

    const folioId = folioRes1.body.data.id;
    const roomTotal = parseFloat(folioRes1.body.data.balance);
    expect(roomTotal).toBeGreaterThan(0);

    const chargeRes = await supertest
      .post(`/api/v1/billing/folios/${folioId}/charges`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        category: 'RESTAURANT',
        description: 'Room service dinner',
        unitPrice: 45,
        quantity: 1,
        taxAmount: 4.5,
      });

    expect(chargeRes.status).toBe(201);

    const folioRes2 = await supertest
      .get(`/api/v1/billing/folios/${folioId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    const totalDue = parseFloat(folioRes2.body.data.balance);

    const payRes = await supertest
      .post(`/api/v1/billing/folios/${folioId}/payments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        amount: totalDue,
        method: 'CREDIT_CARD',
        notes: 'Settle bill',
      });

    expect(payRes.status).toBe(201);
    expect(parseFloat(payRes.body.data.balance)).toBeLessThanOrEqual(0.01);

    const coRes = await supertest
      .post(`/api/v1/reservations/${reservationId}/check-out`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(coRes.status).toBe(200);
    expect(coRes.body.data.status).toBe('CHECKED_OUT');

    const folioFinal = await supertest
      .get(`/api/v1/billing/folios/${folioId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(parseFloat(folioFinal.body.data.balance)).toBeLessThanOrEqual(0.01);
  });
});
