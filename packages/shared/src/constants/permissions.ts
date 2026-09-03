export const PERMISSIONS = {
  USERS: {
    CREATE: 'users:create',
    READ: 'users:read',
    UPDATE: 'users:update',
    DELETE: 'users:delete',
  },
  ROLES: {
    CREATE: 'roles:create',
    READ: 'roles:read',
    UPDATE: 'roles:update',
    DELETE: 'roles:delete',
  },
  ROOMS: {
    CREATE: 'rooms:create',
    READ: 'rooms:read',
    UPDATE: 'rooms:update',
    DELETE: 'rooms:delete',
    CLEAN: 'rooms:clean',
    INSPECT: 'rooms:inspect',
  },
  GUESTS: {
    CREATE: 'guests:create',
    READ: 'guests:read',
    UPDATE: 'guests:update',
    DELETE: 'guests:delete',
  },
  RESERVATIONS: {
    CREATE: 'reservations:create',
    READ: 'reservations:read',
    UPDATE: 'reservations:update',
    CANCEL: 'reservations:cancel',
    CHECK_IN: 'reservations:check_in',
    CHECK_OUT: 'reservations:check_out',
  },
  BILLING: {
    CREATE_CHARGE: 'billing:create_charge',
    READ: 'billing:read',
    PAY: 'billing:pay',
    REFUND: 'billing:refund',
    VOID: 'billing:void',
    GENERATE_INVOICE: 'billing:generate_invoice',
  },
  HOUSEKEEPING: {
    CREATE_TASK: 'housekeeping:create_task',
    READ: 'housekeeping:read',
    UPDATE_TASK: 'housekeeping:update_task',
  },
  MAINTENANCE: {
    CREATE_ORDER: 'maintenance:create_order',
    READ: 'maintenance:read',
    UPDATE_ORDER: 'maintenance:update_order',
    RESOLVE: 'maintenance:resolve',
  },
  RESTAURANT: {
    CREATE_MENU_ITEM: 'restaurant:create_menu_item',
    READ: 'restaurant:read',
    UPDATE_MENU_ITEM: 'restaurant:update_menu_item',
    CREATE_ORDER: 'restaurant:create_order',
    UPDATE_ORDER: 'restaurant:update_order',
  },
  INVENTORY: {
    CREATE: 'inventory:create',
    READ: 'inventory:read',
    UPDATE: 'inventory:update',
    DELETE: 'inventory:delete',
    MOVEMENT: 'inventory:movement',
  },
  EMPLOYEES: {
    CREATE: 'employees:create',
    READ: 'employees:read',
    UPDATE: 'employees:update',
    DELETE: 'employees:delete',
  },
  REPORTS: {
    VIEW_OPERATIONAL: 'reports:view_operational',
    VIEW_FINANCIAL: 'reports:view_financial',
  },
  ANALYTICS: {
    VIEW: 'analytics:view',
    DELETE: 'analytics:delete',
  },
  SYSTEM: {
    SETTINGS: 'system:settings',
    AUDIT_LOGS: 'system:audit_logs',
  },
} as const;

// Union of every permission value string across all modules. A mapped type is
// required here: indexing the union of module objects by `keyof` would yield only
// keys common to *all* modules (e.g. REPORTS/SYSTEM have no READ), collapsing the
// type to `never`. Indexing each module by its own keys preserves every literal.
export type PermissionType = {
  [
    Module in keyof typeof PERMISSIONS
  ]: (typeof PERMISSIONS)[Module][keyof (typeof PERMISSIONS)[Module]];
}[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS).flatMap((module) =>
  Object.values(module),
) as PermissionType[];
