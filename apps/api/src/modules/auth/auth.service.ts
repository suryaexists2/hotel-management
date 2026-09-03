import { Prisma, prisma } from '@innsight/database';
import { SYSTEM_ROLES, ALL_PERMISSIONS } from '@innsight/shared';
import type { LoginInput, UserCreateInput, UserSessionPayload } from '@innsight/shared';
import { UnauthorizedError, ConflictError, ValidationError, NotFoundError } from '../../shared/errors/app-error.js';
import { passwordService, type PasswordHasher } from './password.service.js';
import { tokenService, type TokenService } from './token.service.js';
import { emailService } from '../../shared/email/email.service.js';
import crypto from 'crypto';

// ─── Lockout policy ──────────────────────────────────
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// A structurally valid bcrypt hash (of a random throwaway string) compared against
// when no user is found, so response timing does not reveal account existence.
const DUMMY_PASSWORD_HASH = '$2b$12$WZwiq6mhycUmhl2yGo9RA.9Fs4Qn.VC4EUccqXKG6AEMotX9jYuum';

// ─── Typed Prisma selections ─────────────────────────
const userWithRoleInclude = {
  role: { include: { permissions: { include: { permission: true } } } },
} satisfies Prisma.UserInclude;

type UserWithRole = Prisma.UserGetPayload<{ include: typeof userWithRoleInclude }>;

// ─── Public DTOs ─────────────────────────────────────
export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  status: UserWithRole['status'];
  hotelId: string;
  role: { id: string; name: string };
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface LoginResult extends AuthTokens {
  user: PublicUser;
}

/**
 * Authentication use-cases. Depends only on the `PasswordHasher` and `TokenService`
 * abstractions plus Prisma, so credential verification, token strategy and storage
 * are each independently replaceable. New strategies (OAuth, SSO) can be added as
 * sibling methods that reuse `issueTokens` without altering existing flows (OCP).
 */
export class AuthService {
  constructor(
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  private toPermissionKeys(user: UserWithRole): string[] {
    return user.role.permissions.map((rp) => `${rp.permission.module}:${rp.permission.action}`);
  }

  /**
   * Platform super-admin is derived from a trustworthy signal — a *system* role
   * named SUPER_ADMIN — never from the role name alone. Tenant-created roles are
   * always `isSystem: false`, so they can never gain the bypass.
   */
  private isSuperAdmin(user: UserWithRole): boolean {
    return user.role.isSystem && user.role.name === SYSTEM_ROLES.SUPER_ADMIN;
  }

  private toSessionPayload(user: UserWithRole): UserSessionPayload {
    return {
      userId: user.id,
      email: user.email,
      hotelId: user.hotelId,
      role: user.role.name,
      permissions: this.toPermissionKeys(user),
      isSuperAdmin: this.isSuperAdmin(user),
    };
  }

  private toPublicUser(user: UserWithRole): PublicUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      status: user.status,
      hotelId: user.hotelId,
      role: { id: user.role.id, name: user.role.name },
      permissions: this.toPermissionKeys(user),
    };
  }

  /**
   * Issue a fresh access token and a persisted (hashed) rotating refresh token.
   * Shared by login and refresh so token issuance lives in exactly one place.
   */
  private async issueTokens(user: UserWithRole): Promise<AuthTokens> {
    const accessToken = this.tokens.signAccessToken(this.toSessionPayload(user));
    const refresh = this.tokens.generateRefreshToken();

    await prisma.refreshToken.create({
      data: {
        token: refresh.hash,
        userId: user.id,
        expiresAt: refresh.expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: refresh.raw,
      refreshTokenExpiresAt: refresh.expiresAt,
    };
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: userWithRoleInclude,
    });

    // Uniform error for "no such user" and "wrong password" to avoid user enumeration.
    const invalidCredentials = new UnauthorizedError('Invalid email or password');

    if (!user) {
      // Run a comparison anyway to keep timing roughly constant against enumeration.
      await this.hasher.compare(input.password, DUMMY_PASSWORD_HASH);
      throw invalidCredentials;
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedError('Account is temporarily locked. Please try again later.');
    }

    // Lock window has passed — reset the counter so the user gets a fresh set of attempts.
    if (user.failedAttempts > 0 && (!user.lockedUntil || user.lockedUntil <= new Date())) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: 0, lockedUntil: null },
      });
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Account is not active. Contact your administrator.');
    }

    const passwordMatches = await this.hasher.compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      await this.registerFailedAttempt(user);
      throw invalidCredentials;
    }

    // Success: reset lockout counters and stamp the login.
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  private async registerFailedAttempt(user: UserWithRole): Promise<void> {
    // Atomic increment closes the read-modify-write race where concurrent attempts
    // would otherwise clobber each other's count and let an attacker exceed the cap.
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: { increment: 1 } },
      select: { failedAttempts: true },
    });

    if (updated.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) },
      });
    }
  }

  /** Revoke every still-active refresh token for a user (theft response / global logout). */
  private async revokeAllForUser(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Rotate a refresh token with reuse detection.
   *
   * A token that is presented while already revoked — or that loses the atomic
   * claim below to a concurrent request — indicates replay of a rotated/stolen
   * token. In that case the entire token family for the user is revoked, forcing
   * re-authentication and neutralising the theft (OWASP refresh-token rotation).
   */
  async refresh(rawRefreshToken: string): Promise<AuthTokens> {
    const tokenHash = this.tokens.hashRefreshToken(rawRefreshToken);

    const stored = await prisma.refreshToken.findUnique({
      where: { token: tokenHash },
      include: { user: { include: userWithRoleInclude } },
    });

    if (!stored) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Reuse of an already-revoked token => probable theft. Nuke the whole family.
    if (stored.revokedAt) {
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedError('Refresh token reuse detected; all sessions revoked');
    }

    if (stored.expiresAt <= new Date()) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    if (stored.user.lockedUntil && stored.user.lockedUntil > new Date()) {
      throw new UnauthorizedError('Account is temporarily locked. Please try again later.');
    }

    if (stored.user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Account is not active. Contact your administrator.');
    }

    const nextRefresh = this.tokens.generateRefreshToken();

    // Atomically claim this token: only the first concurrent caller flips revokedAt
    // from null. A zero count means someone already rotated it — treat as reuse.
    const claim = await prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date(), replacedBy: nextRefresh.hash },
    });

    if (claim.count === 0) {
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedError('Refresh token reuse detected; all sessions revoked');
    }

    await prisma.refreshToken.create({
      data: {
        token: nextRefresh.hash,
        userId: stored.userId,
        expiresAt: nextRefresh.expiresAt,
      },
    });

    const accessToken = this.tokens.signAccessToken(this.toSessionPayload(stored.user));

    return {
      accessToken,
      refreshToken: nextRefresh.raw,
      refreshTokenExpiresAt: nextRefresh.expiresAt,
    };
  }

  /** Revoke a refresh token. Idempotent — unknown/already-revoked tokens are a no-op. */
  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.tokens.hashRefreshToken(rawRefreshToken);
    await prisma.refreshToken.updateMany({
      where: { token: tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: userWithRoleInclude,
    });

    if (!user) {
      throw new UnauthorizedError('User no longer exists');
    }

    return this.toPublicUser(user);
  }

  /**
   * Register a new hotel + admin user. Creates the hotel, its settings, a default HOTEL_ADMIN
   * role with all permissions, and the admin user account.
   */
  async register(input: UserCreateInput & { hotelName: string; hotelPhone: string; hotelAddress: string }): Promise<LoginResult> {
    const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingUser) {
      throw new ConflictError('An account with this email already exists');
    }

    const slug = input.hotelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + crypto.randomBytes(3).toString('hex');

    const hotel = await prisma.hotel.create({
      data: {
        name: input.hotelName,
        slug,
        address: input.hotelAddress,
        city: '',
        country: '',
        phone: input.hotelPhone,
        email: input.email,
      },
    });

    await prisma.hotelSettings.create({
      data: { hotelId: hotel.id, supportedCurrencies: JSON.stringify(['USD']) as any },
    });

    let allPermissions = await prisma.permission.findMany({ select: { id: true } });
    if (allPermissions.length === 0) {
      // Seed permissions from shared constants so newly registered hotels work
      for (const key of ALL_PERMISSIONS) {
        const parts = key.split(':');
        await prisma.permission.create({
          data: { module: parts[0]!, action: parts[1]!, description: `${parts[1]} ${parts[0]}` },
        });
      }
      allPermissions = await prisma.permission.findMany({ select: { id: true } });
    }
    const adminRole = await prisma.role.create({
      data: {
        name: 'HOTEL_ADMIN',
        description: 'Full access to all hotel features',
        isSystem: true,
        hotelId: hotel.id,
        permissions: allPermissions.length > 0
          ? { create: allPermissions.map((p) => ({ permissionId: p.id })) }
          : undefined,
      },
    });

    const passwordHash = await this.hasher.hash(input.password);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        hotelId: hotel.id,
        roleId: adminRole.id,
        createdBy: 'self-register',
      },
      include: userWithRoleInclude,
    });

    const tokens = await this.issueTokens(user);
    return { user: this.toPublicUser(user), ...tokens };
  }

  async forgotPassword(email: string): Promise<{ message: string; resetToken?: string }> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal whether the email exists
      return { message: 'If an account with that email exists, a password reset link has been sent.' };
    }

    // Deactivate any existing unused tokens for this email
    await prisma.passwordResetToken.updateMany({
      where: { email, usedAt: null, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { email, token: resetToken, expiresAt },
    });

    // Send the email
    await emailService.sendPasswordReset(email, resetToken);

    return { message: 'Password reset link sent. Check your email.' };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      throw new NotFoundError('Invalid or expired reset token');
    }

    if (resetToken.usedAt) {
      throw new ValidationError('This reset token has already been used');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new ValidationError('Reset token has expired. Please request a new one.');
    }

    const user = await prisma.user.findUnique({ where: { email: resetToken.email } });
    if (!user) {
      throw new NotFoundError('User no longer exists');
    }

    const newHash = await this.hasher.hash(newPassword);

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } }),
      prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    ]);
  }
}

export const authService = new AuthService(passwordService, tokenService);
