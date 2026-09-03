export interface StandardResponse<T> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  } | null;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface UserSessionPayload {
  userId: string;
  email: string;
  hotelId: string;
  role: string;
  permissions: string[];
  /**
   * Server-derived platform super-admin flag. Authorization must key on this,
   * never on `role` (a tenant-settable display name), to prevent a hotel from
   * escalating privilege by naming a custom role "SUPER_ADMIN".
   */
  isSuperAdmin: boolean;
}
