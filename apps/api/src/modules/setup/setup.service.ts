import { prisma } from '@innsight/database';
import bcrypt from 'bcrypt';
import type { SetupHotelInput } from '@innsight/shared';
import { ALL_PERMISSIONS } from '@innsight/shared';
import { ConflictError } from '../../shared/errors/app-error.js';
import { authService } from '../auth/auth.service.js';

export class SetupService {
  async check(): Promise<{ configured: boolean }> {
    const userCount = await prisma.user.count();
    return { configured: userCount > 0 };
  }

  async setup(input: SetupHotelInput): Promise<{
    hotelId: string;
    accessToken: string;
    refreshToken: string;
    message: string;
  }> {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      throw new ConflictError('System is already configured');
    }

    const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const hotel = await prisma.hotel.create({
      data: {
        name: input.name,
        slug,
        phone: input.phone,
        address: input.address,
        city: 'N/A',
        country: 'N/A',
        email: input.email,
        currency: 'INR',
        currencySymbol: 'Rs.',
        timezone: 'Asia/Kolkata',
      },
    });

    // Seed permissions so subsequent registrations work
    const existingPermissions = await prisma.permission.count();
    if (existingPermissions === 0) {
      for (const key of ALL_PERMISSIONS) {
        const parts = key.split(':');
        await prisma.permission.create({
          data: { module: parts[0]!, action: parts[1]!, description: `${parts[1]} ${parts[0]}` },
        });
      }
    }

    const adminRole = await prisma.role.create({
      data: {
        hotelId: hotel.id,
        name: 'SUPER_ADMIN',
        description: 'Super Administrator with full system access',
        isSystem: true,
      },
    });

    const hashedPassword = await bcrypt.hash(input.password, 12);

    await prisma.user.create({
      data: {
        hotelId: hotel.id,
        email: input.email,
        passwordHash: hashedPassword,
        firstName: input.name.split(' ')[0] || 'Admin',
        lastName: 'Administrator',
        roleId: adminRole.id,
      },
    });

    await prisma.hotelSettings.create({
      data: {
        hotelId: hotel.id,
        defaultTaxRate: 0,
      },
    });

    await prisma.roomType.create({
      data: {
        hotelId: hotel.id,
        name: 'Standard',
        description: 'Standard room',
        baseRate: 0,
        maxOccupancy: 2,
        maxAdults: 2,
        maxChildren: 1,
        amenities: '[]' as any,
        sortOrder: 0,
        isActive: true,
      },
    });

    // Generate tokens for auto-login
    const loginResult = await authService.login({
      email: input.email,
      password: input.password,
    });

    return {
      hotelId: hotel.id,
      accessToken: loginResult.accessToken,
      refreshToken: loginResult.refreshToken,
      message: 'Hotel setup complete. Welcome to your dashboard!',
    };
  }
}

export const setupService = new SetupService();
