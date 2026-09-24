import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const withVenue = { venue: true } satisfies Prisma.EventInclude;

export const eventRepository = {
  listPublished() {
    return prisma.event.findMany({
      where: { isPublished: true },
      include: withVenue,
      orderBy: [{ startDateTime: 'asc' }, { displayOrder: 'asc' }],
    });
  },
  listAll() {
    return prisma.event.findMany({ include: withVenue, orderBy: [{ displayOrder: 'asc' }, { startDateTime: 'asc' }] });
  },
  findBySlug(slug: string) {
    return prisma.event.findUnique({ where: { slug }, include: withVenue });
  },
  findById(id: string) {
    return prisma.event.findUnique({ where: { id }, include: withVenue });
  },
  create(data: Prisma.EventUncheckedCreateInput) {
    return prisma.event.create({ data, include: withVenue });
  },
  update(id: string, data: Prisma.EventUncheckedUpdateInput) {
    return prisma.event.update({ where: { id }, data, include: withVenue });
  },
  delete(id: string) {
    return prisma.event.delete({ where: { id } });
  },
  async reorder(ids: string[]) {
    await prisma.$transaction(ids.map((id, index) => prisma.event.update({ where: { id }, data: { displayOrder: index + 1 } })));
  },
};
