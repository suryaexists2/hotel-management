import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@innsight/database';
import { AppError } from '../shared/errors/app-error.js';
import { env } from '../config/env.js';

interface ErrorBody {
  code: string;
  message: string;
  details?: unknown;
  stack?: string;
}

function send(res: Response, status: number, error: ErrorBody): void {
  res.status(status).json({ success: false, data: null, error });
}

/**
 * Single global error boundary. Normalises the three error shapes the app produces
 * — domain `AppError`s, Zod validation failures, and Prisma known-request errors —
 * into the standard envelope so clients get consistent codes/status everywhere.
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    send(res, err.statusCode, {
      code: err.code,
      message: err.message,
      details: err.details ?? null,
    });
    return;
  }

  if (err instanceof ZodError) {
    send(res, 400, {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = mapPrismaError(err);
    send(res, mapped.status, { code: mapped.code, message: mapped.message });
    return;
  }

  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    const msg = err.message?.includes('encoding') || err.message?.includes('WIN1252')
      ? 'Character encoding mismatch. Please use only standard ASCII characters.'
      : 'A database error occurred';
    send(res, 400, { code: 'DATABASE_ERROR', message: msg });
    return;
  }

  // Unexpected: log server-side, never leak internals to the client.
  console.error('💥 Unexpected Server Error:', err);

  send(res, 500, {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred on the server',
    ...(env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
};

function mapPrismaError(err: Prisma.PrismaClientKnownRequestError): {
  status: number;
  code: string;
  message: string;
} {
  switch (err.code) {
    case 'P2002': {
      const target = err.meta?.target;
      const fields = Array.isArray(target) ? target.join(', ') : 'field';
      return { status: 409, code: 'CONFLICT', message: `A record with this ${fields} already exists` };
    }
    case 'P2025':
      return { status: 404, code: 'NOT_FOUND', message: 'The requested record was not found' };
    case 'P2003':
      return { status: 400, code: 'FOREIGN_KEY_VIOLATION', message: 'Related record does not exist' };
    default:
      return { status: 400, code: 'DATABASE_ERROR', message: 'The database rejected the request' };
  }
}
