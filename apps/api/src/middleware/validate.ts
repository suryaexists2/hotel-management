import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type infer as ZodInfer } from 'zod';
import { ValidationError } from '../shared/errors/app-error.js';

/**
 * Validate and coerce `req.body` against a Zod schema. On success the parsed
 * (typed) value replaces the raw body; on failure a 400 `ValidationError` is
 * raised carrying the flattened field issues.
 */
export function validateBody<TSchema extends ZodTypeAny>(schema: TSchema): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(new ValidationError('Request validation failed', flattenIssues(result.error)));
      return;
    }

    req.body = result.data as ZodInfer<TSchema>;
    next();
  };
}

function flattenIssues(error: ZodError): Record<string, string[] | undefined> {
  return error.flatten().fieldErrors;
}
