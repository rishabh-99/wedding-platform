import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

/** Converts any thrown error into a friendly JSON response. Stack traces never reach guests in production. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong on our side. Please try again in a moment.';
  let details: unknown;

  if (err instanceof AppError) {
    ({ status, code, message, details } = err);
  } else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = err.code;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'That file is too large.' : 'The upload could not be processed.';
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      status = 409;
      code = 'CONFLICT';
      message = 'That value is already in use.';
    } else if (err.code === 'P2025') {
      status = 404;
      code = 'NOT_FOUND';
      message = 'Not found';
    } else if (err.code === 'P2003') {
      status = 400;
      code = 'INVALID_REFERENCE';
      message = 'A referenced item does not exist.';
    }
  } else if (isClientHttpError(err)) {
    // http-errors from Express internals (e.g. express.static refusing a malformed/traversal path).
    status = err.status;
    code = status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST';
    message = status === 404 ? 'Not found' : status === 403 ? 'Forbidden' : 'Bad request';
  } else if ((err as { type?: string }).type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'The request is too large.';
  } else if ((err as { type?: string }).type === 'entity.parse.failed') {
    status = 400;
    code = 'BAD_JSON';
    message = 'The request body is not valid JSON.';
  }

  if (status >= 500) logger.error({ err, url: req.originalUrl, method: req.method }, 'request failed');
  else logger.debug({ code, url: req.originalUrl }, message);

  if (res.headersSent) return;
  res.status(status).json({
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      ...(!env.isProd && status >= 500 && err instanceof Error ? { debug: err.stack } : {}),
    },
  });
}

function isClientHttpError(err: unknown): err is { status: number } {
  const status = (err as { status?: unknown; expose?: unknown } | null)?.status;
  return typeof status === 'number' && status >= 400 && status < 500 && (err as { type?: string }).type === undefined;
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No API route for ${req.method} ${req.path}` } });
}
