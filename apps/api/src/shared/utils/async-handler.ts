import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wrap an async route handler so that any rejected promise is forwarded to the
 * Express error pipeline instead of crashing the process. Keeps controllers free
 * of repetitive try/catch while preserving full typing.
 */
type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
