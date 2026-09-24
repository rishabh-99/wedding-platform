import { Prisma, type User } from '@prisma/client';
import type { TeamUserDTO, teamUserCreateSchema, teamUserUpdateSchema } from '@wedding/shared';
import type { z } from 'zod';
import { badRequest, conflict, notFound } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { hashPassword } from './auth.service';

/** Staff accounts: admins, content editors, event coordinators, hospitality, photographers. */

const toDTO = (u: User): TeamUserDTO => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  phone: u.phone,
  isActive: u.isActive,
  lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  createdAt: u.createdAt.toISOString(),
});

async function activeAdminCount(excludeId?: string) {
  return prisma.user.count({ where: { role: 'ADMIN', isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) } });
}

export const teamService = {
  async list(): Promise<TeamUserDTO[]> {
    const users = await prisma.user.findMany({ orderBy: [{ role: 'asc' }, { name: 'asc' }] });
    return users.map(toDTO);
  },

  async create(input: z.output<typeof teamUserCreateSchema>): Promise<TeamUserDTO> {
    try {
      const user = await prisma.user.create({
        data: { name: input.name, email: input.email, role: input.role, phone: input.phone, passwordHash: await hashPassword(input.password) },
      });
      return toDTO(user);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw conflict('Someone on the team already uses this email');
      }
      throw err;
    }
  },

  async update(id: string, input: z.output<typeof teamUserUpdateSchema>, actingUserId: string): Promise<TeamUserDTO> {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw notFound('Team member');
    const losingAdmin = existing.role === 'ADMIN' && existing.isActive && (input.role !== 'ADMIN' || !input.isActive);
    if (losingAdmin && (await activeAdminCount(id)) === 0) {
      throw badRequest('There must always be at least one active admin');
    }
    if (id === actingUserId && (!input.isActive || input.role !== 'ADMIN')) {
      throw badRequest('You cannot deactivate yourself or remove your own admin access');
    }
    const user = await prisma.user.update({
      where: { id },
      data: {
        name: input.name,
        role: input.role,
        phone: input.phone,
        isActive: input.isActive,
        // A new password invalidates the member's existing sessions (password version changes).
        ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
      },
    });
    return toDTO(user);
  },

  async remove(id: string, actingUserId: string): Promise<void> {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw notFound('Team member');
    if (id === actingUserId) throw badRequest('You cannot delete your own account');
    if (existing.role === 'ADMIN' && existing.isActive && (await activeAdminCount(id)) === 0) {
      throw badRequest('There must always be at least one active admin');
    }
    await prisma.user.delete({ where: { id } });
  },
};
