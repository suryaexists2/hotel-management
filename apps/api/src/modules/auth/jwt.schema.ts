import { z } from 'zod';
import type { UserSessionPayload } from '@innsight/shared';

/**
 * Runtime shape of a decoded access-token payload. Validating with Zod (rather
 * than trusting `jwt.verify`'s `string | JwtPayload` return) lets us hand callers
 * a fully-typed `UserSessionPayload` without resorting to `any` or unchecked casts.
 */
export const sessionPayloadSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  hotelId: z.string().min(1),
  role: z.string().min(1),
  permissions: z.array(z.string()),
  isSuperAdmin: z.boolean(),
});

// Compile-time guarantee that the schema stays in sync with the shared contract.
type SchemaMatchesContract =
  z.infer<typeof sessionPayloadSchema> extends UserSessionPayload
    ? UserSessionPayload extends z.infer<typeof sessionPayloadSchema>
      ? true
      : never
    : never;
const _assertSchemaMatchesContract: SchemaMatchesContract = true;
void _assertSchemaMatchesContract;
