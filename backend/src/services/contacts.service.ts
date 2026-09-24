import type { ContactDTO, contactInputSchema } from '@wedding/shared';
import type { z } from 'zod';
import { badRequest, notFound } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { toContactDTO } from './mappers';

type ContactInput = z.output<typeof contactInputSchema>;
const include = { event: { select: { id: true, name: true, slug: true } } } as const;

/** Event managers & other helpful contacts. Public ones appear in the concierge and on event pages. */
export const contactsService = {
  async list(includePrivate = false): Promise<ContactDTO[]> {
    const rows = await prisma.contact.findMany({
      where: includePrivate ? {} : { isPublic: true },
      include,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toContactDTO);
  },

  async create(input: ContactInput): Promise<ContactDTO> {
    await assertEvent(input.eventId);
    return toContactDTO(await prisma.contact.create({ data: input, include }));
  },

  async update(id: string, input: ContactInput): Promise<ContactDTO> {
    if (!(await prisma.contact.findUnique({ where: { id } }))) throw notFound('Contact');
    await assertEvent(input.eventId);
    return toContactDTO(await prisma.contact.update({ where: { id }, data: input, include }));
  },

  async remove(id: string): Promise<void> {
    if (!(await prisma.contact.findUnique({ where: { id } }))) throw notFound('Contact');
    await prisma.contact.delete({ where: { id } });
  },
};

async function assertEvent(eventId: string | null) {
  if (eventId && !(await prisma.event.findUnique({ where: { id: eventId } }))) {
    throw badRequest('That celebration no longer exists', { fields: { eventId: 'Choose a celebration' } });
  }
}
