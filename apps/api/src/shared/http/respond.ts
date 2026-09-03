import type { Response } from 'express';
import type { PaginationMeta, StandardResponse } from '@innsight/shared';

/**
 * Response envelope helpers. Every controller replies through these so the
 * `{ success, data, error, meta? }` contract is applied identically everywhere and
 * status codes stay consistent.
 */

export function sendOk<T>(res: Response, data: T, status = 200): void {
  const body: StandardResponse<T> = { success: true, data, error: null };
  res.status(status).json(body);
}

export function sendCreated<T>(res: Response, data: T): void {
  sendOk(res, data, 201);
}

export function sendPaginated<T>(res: Response, data: T[], meta: PaginationMeta): void {
  const body: StandardResponse<T[]> = { success: true, data, error: null, meta };
  res.status(200).json(body);
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}
