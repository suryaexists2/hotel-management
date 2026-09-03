import { Router } from 'express';
import { setupRouter } from '../modules/setup/setup.routes.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { userRouter } from '../modules/users/user.routes.js';
import { roleRouter } from '../modules/roles/role.routes.js';
import { hotelRouter } from '../modules/hotel/hotel.routes.js';
import { roomTypeRouter, roomRouter } from '../modules/rooms/room.routes.js';
import { guestRouter } from '../modules/guests/guest.routes.js';
import { reservationRouter } from '../modules/reservations/reservation.routes.js';
import { billingRouter } from '../modules/billing/billing.routes.js';
import { employeeRouter } from '../modules/employees/employee.routes.js';
import { housekeepingRouter } from '../modules/housekeeping/housekeeping.routes.js';
import { maintenanceRouter } from '../modules/maintenance/maintenance.routes.js';
import { auditRouter } from '../modules/audit/audit.routes.js';
import { menuRouter, orderRouter } from '../modules/restaurant/restaurant.routes.js';
import { supplierRouter, inventoryRouter } from '../modules/inventory/inventory.routes.js';
import { notificationRouter } from '../modules/notifications/notification.routes.js';
import { reportsRouter } from '../modules/reports/reports.routes.js';
import { analyticsRouter } from '../modules/analytics/analytics.routes.js';

/**
 * Aggregate API v1 router. Feature modules mount their sub-routers here, keeping
 * `app.ts` agnostic of individual domains (open for extension in later milestones).
 */
export const apiV1Router: Router = Router();

apiV1Router.use('/setup', setupRouter);
apiV1Router.use('/auth', authRouter);
apiV1Router.use('/users', userRouter);
apiV1Router.use('/roles', roleRouter);
apiV1Router.use('/hotel', hotelRouter);
apiV1Router.use('/room-types', roomTypeRouter);
apiV1Router.use('/rooms', roomRouter);
apiV1Router.use('/guests', guestRouter);
apiV1Router.use('/reservations', reservationRouter);
apiV1Router.use('/billing', billingRouter);
apiV1Router.use('/employees', employeeRouter);
apiV1Router.use('/housekeeping', housekeepingRouter);
apiV1Router.use('/maintenance', maintenanceRouter);
apiV1Router.use('/audit-logs', auditRouter);
apiV1Router.use('/menu', menuRouter);
apiV1Router.use('/orders', orderRouter);
apiV1Router.use('/suppliers', supplierRouter);
apiV1Router.use('/inventory', inventoryRouter);
apiV1Router.use('/notifications', notificationRouter);
apiV1Router.use('/reports', reportsRouter);
apiV1Router.use('/analytics', analyticsRouter);
