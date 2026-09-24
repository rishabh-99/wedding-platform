import { Prisma } from '@prisma/client';
import type {
  faqInputSchema,
  storySectionInputSchema,
  travelSectionInputSchema,
  venueInputSchema,
} from '@wedding/shared';
import type { z } from 'zod';
import { conflict, notFound } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { broker } from '../realtime/sseBroker';
import { toFaqDTO, toStoryDTO, toTravelDTO, toVenueDTO } from './mappers';

/** Editable editorial content: venues, story, travel & stay, FAQ. */

async function ensure<T>(p: Promise<T | null>, what: string): Promise<T> {
  const v = await p;
  if (!v) throw notFound(what);
  return v;
}

function uniqueGuard(message: string) {
  return (err: unknown): never => {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw conflict(message);
    throw err;
  };
}

export const venueService = {
  async list() {
    return (await prisma.venue.findMany({ orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] })).map(toVenueDTO);
  },
  async create(input: z.output<typeof venueInputSchema>) {
    const v = await prisma.venue.create({ data: input });
    broker.publish('SCHEDULE_CHANGED');
    return toVenueDTO(v);
  },
  async update(id: string, input: z.output<typeof venueInputSchema>) {
    await ensure(prisma.venue.findUnique({ where: { id } }), 'Venue');
    const v = await prisma.venue.update({ where: { id }, data: input });
    broker.publish('SCHEDULE_CHANGED');
    return toVenueDTO(v);
  },
  async remove(id: string) {
    await ensure(prisma.venue.findUnique({ where: { id } }), 'Venue');
    await prisma.venue.delete({ where: { id } });
    broker.publish('SCHEDULE_CHANGED');
  },
};

const storyInclude = { mediaAsset: true } satisfies Prisma.StorySectionInclude;

export const storyService = {
  async list(includeHidden = false) {
    const rows = await prisma.storySection.findMany({
      where: includeHidden ? {} : { isPublished: true },
      include: storyInclude,
      orderBy: { displayOrder: 'asc' },
    });
    return Promise.all(rows.map(toStoryDTO));
  },
  async create(input: z.output<typeof storySectionInputSchema>) {
    const row = await prisma.storySection
      .create({ data: input, include: storyInclude })
      .catch(uniqueGuard('A story section with this key already exists'));
    return toStoryDTO(row);
  },
  async update(id: string, input: z.output<typeof storySectionInputSchema>) {
    await ensure(prisma.storySection.findUnique({ where: { id } }), 'Story section');
    const row = await prisma.storySection
      .update({ where: { id }, data: input, include: storyInclude })
      .catch(uniqueGuard('A story section with this key already exists'));
    return toStoryDTO(row);
  },
  async remove(id: string) {
    await ensure(prisma.storySection.findUnique({ where: { id } }), 'Story section');
    await prisma.storySection.delete({ where: { id } });
  },
};

export const travelService = {
  async list(includeHidden = false) {
    const rows = await prisma.travelSection.findMany({
      where: includeHidden ? {} : { isPublished: true },
      orderBy: { displayOrder: 'asc' },
    });
    return rows.map(toTravelDTO);
  },
  async create(input: z.output<typeof travelSectionInputSchema>) {
    return toTravelDTO(await prisma.travelSection.create({ data: { ...input, links: input.links } }));
  },
  async update(id: string, input: z.output<typeof travelSectionInputSchema>) {
    await ensure(prisma.travelSection.findUnique({ where: { id } }), 'Travel section');
    return toTravelDTO(await prisma.travelSection.update({ where: { id }, data: { ...input, links: input.links } }));
  },
  async remove(id: string) {
    await ensure(prisma.travelSection.findUnique({ where: { id } }), 'Travel section');
    await prisma.travelSection.delete({ where: { id } });
  },
};

export const faqService = {
  async list(includeHidden = false) {
    const rows = await prisma.faqItem.findMany({
      where: includeHidden ? {} : { isPublished: true },
      orderBy: { displayOrder: 'asc' },
    });
    return rows.map(toFaqDTO);
  },
  async create(input: z.output<typeof faqInputSchema>) {
    return toFaqDTO(await prisma.faqItem.create({ data: input }));
  },
  async update(id: string, input: z.output<typeof faqInputSchema>) {
    await ensure(prisma.faqItem.findUnique({ where: { id } }), 'FAQ item');
    return toFaqDTO(await prisma.faqItem.update({ where: { id }, data: input }));
  },
  async remove(id: string) {
    await ensure(prisma.faqItem.findUnique({ where: { id } }), 'FAQ item');
    await prisma.faqItem.delete({ where: { id } });
  },
};
