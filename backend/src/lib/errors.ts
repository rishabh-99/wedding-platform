import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodSchema, ZodTypeDef } from 'zod';

/** Error carrying an HTTP status and a message that is safe to show to users. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Please sign in to continue') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have permission to do that') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);
export const tooLarge = (message: string) => new AppError(413, 'PAYLOAD_TOO_LARGE', message);
export const unsupported = (message: string) => new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', message);

/** Wraps an async handler so rejected promises reach the error middleware. */
export function asyncHandler<Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req as Req, res, next).catch(next);
  };
}

/** Parses input with a zod schema; throws a friendly 400 with field errors on failure. */
export function parse<Out, In = Out>(schema: ZodSchema<Out, ZodTypeDef, In>, data: unknown): Out {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    throw new AppError(400, 'VALIDATION_ERROR', 'Please check the highlighted fields', { fields });
  }
  return result.data;
}
