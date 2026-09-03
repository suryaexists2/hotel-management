import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production') {
    res.on('finish', () => {
      if (res.statusCode >= 400) {
        console.error(`[API] ${req.method} ${req.originalUrl} - ${res.statusCode}`);
      }
    });
  } else {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[API] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
  }
  next();
};
