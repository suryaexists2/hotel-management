import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import {
  ALL_PERMISSIONS,
  SYSTEM_ROLES,
  ROLE_PERMISSIONS,
  type SystemRoleType,
  type PermissionType,
} from '@innsight/shared';

/**
 * Idempotent database seed.
 *
 * Running this script multiple times converges to the same state:
 *  - every permission in the shared PERMISSIONS matrix exists exactly once
 *  - every system role exists for the demo hotel with its permission map re-synced
 *  - a demo hotel (+ settings) exists
 *  - a bootstrap HOTEL_ADMIN user exists (password is only set on first creation)
 *
 * All writes use upserts keyed on the schema's unique constraints, so re-seeding
 * never creates duplicates and never throws on conflict.
 */

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

// ─── Demo tenant + bootstrap admin (overridable via env) ─────────────
const DEMO_HOTEL_SLUG = process.env.SEED_HOTEL_SLUG ?? 'grand-innsight';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@innsight.io';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';

/** Split a "module:action" permission key into its parts. */
function splitPermission(key: PermissionType): { module: string; action: string } {
  const [module, action] = key.split(':');
  if (!module || !action) {
    throw new Error(`Malformed permission key encountered during seed: "${key}"`);
  }
  return { module, action };
}

async function seedPermissions(): Promise<Map<PermissionType, string>> {
  const permissionIdByKey = new Map<PermissionType, string>();

  for (const key of ALL_PERMISSIONS) {
    const { module, action } = splitPermission(key);
    const permission = await prisma.permission.upsert({
      where: { module_action: { module, action } },
      update: { description: `${action} ${module}` },
      create: { module, action, description: `${action} ${module}` },
    });
    permissionIdByKey.set(key, permission.id);
  }

  console.log(`  ✓ ${permissionIdByKey.size} permissions synced`);
  return permissionIdByKey;
}

async function seedHotel(): Promise<string> {
  const hotel = await prisma.hotel.upsert({
    where: { slug: DEMO_HOTEL_SLUG },
    update: {},
    create: {
      name: 'Grand InnSight Hotel',
      slug: DEMO_HOTEL_SLUG,
      address: '1 Hospitality Avenue',
      city: 'Metropolis',
      state: 'CA',
      country: 'USA',
      zipCode: '90001',
      phone: '+1-555-0100',
      email: 'front-desk@innsight.io',
      currency: 'USD',
      currencySymbol: '$',
      timezone: 'America/Los_Angeles',
    },
  });

  await prisma.hotelSettings.upsert({
    where: { hotelId: hotel.id },
    update: {},
    create: {
      hotelId: hotel.id,
      supportedCurrencies: JSON.stringify(['USD']),
    },
  });

  console.log(`  ✓ demo hotel "${hotel.name}" (${hotel.id})`);
  return hotel.id;
}

async function seedRoles(
  hotelId: string,
  permissionIdByKey: Map<PermissionType, string>,
): Promise<Map<SystemRoleType, string>> {
  const roleIdByName = new Map<SystemRoleType, string>();

  for (const roleName of Object.values(SYSTEM_ROLES)) {
    const role = await prisma.role.upsert({
      where: { hotelId_name: { hotelId, name: roleName } },
      update: { isSystem: true },
      create: {
        hotelId,
        name: roleName,
        isSystem: true,
        description: `System role: ${roleName}`,
      },
    });
    roleIdByName.set(roleName, role.id);

    // Re-sync the permission map: clear then re-attach so the role always
    // reflects the current ROLE_PERMISSIONS definition.
    const permissionKeys = ROLE_PERMISSIONS[roleName];
    const permissionIds = permissionKeys
      .map((key) => permissionIdByKey.get(key))
      .filter((id): id is string => Boolean(id));

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      });
    }
  }

  console.log(`  ✓ ${roleIdByName.size} system roles synced with permissions`);
  return roleIdByName;
}

async function seedAdminUser(
  hotelId: string,
  roleIdByName: Map<SystemRoleType, string>,
): Promise<void> {
  const roleId = roleIdByName.get(SYSTEM_ROLES.HOTEL_ADMIN);
  if (!roleId) {
    throw new Error('HOTEL_ADMIN role missing after role seed; cannot create admin user');
  }

  // Never let the well-known default password reach a production database.
  if (process.env.NODE_ENV === 'production' && !process.env.SEED_ADMIN_PASSWORD) {
    throw new Error(
      'Refusing to seed the default admin password in production. Set SEED_ADMIN_PASSWORD explicitly.',
    );
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

  // Password + hotel/role are only set on first creation so re-seeding never
  // resets a rotated password or reassigns an existing account.
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { status: 'ACTIVE' },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      firstName: 'InnSight',
      lastName: 'Administrator',
      status: 'ACTIVE',
      hotelId,
      roleId,
    },
  });

  console.log(`  ✓ bootstrap HOTEL_ADMIN user "${ADMIN_EMAIL}"`);
}

async function main(): Promise<void> {
  console.log('🌱 Seeding InnSight database...');

  const permissionIdByKey = await seedPermissions();
  const hotelId = await seedHotel();
  const roleIdByName = await seedRoles(hotelId, permissionIdByKey);
  await seedAdminUser(hotelId, roleIdByName);

  console.log('✅ Seed complete.');
}

main()
  .catch((error: unknown) => {
    console.error('❌ Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
