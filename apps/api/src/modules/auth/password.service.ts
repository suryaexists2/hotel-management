import bcrypt from 'bcrypt';

/**
 * Password hashing abstraction.
 *
 * Isolated behind an interface so the hashing strategy (bcrypt today, argon2 or a
 * managed provider tomorrow) can be swapped without touching callers — the auth
 * service depends only on `PasswordHasher`, not on bcrypt directly (DIP).
 */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

const SALT_ROUNDS = 12;

export const passwordService: PasswordHasher = {
  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, SALT_ROUNDS);
  },
  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  },
};
