import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';

/** Records admin actions. Never blocks or fails the request. */
export function audit(req: Request, action: string, entity: string, entityId?: string | null, meta?: Record<string, unknown>) {
  const userId = req.user?.id ?? null;
  prisma.auditLog
    .create({
      data: {
        userId,
        action,
        entity,
        entityId: entityId ?? null,
        meta: (meta ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: req.ip ?? null,
      },
    })
    .catch((err) => logger.error({ err }, 'audit log write failed'));
  logger.info({ audit: { userId, action, entity, entityId } }, 'admin action');
}
