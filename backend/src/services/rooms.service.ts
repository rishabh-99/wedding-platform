import type {
  AccommodationDTO,
  RoomAssignmentDTO,
  RoomBoardDTO,
  accommodationInputSchema,
  roomAssignmentInputSchema,
} from '@wedding/shared';
import type { z } from 'zod';
import { badRequest, notFound } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { toAccommodationDTO, toRoomDTO } from './mappers';

/**
 * Room management for guest accommodation: several hotels/venues, each with
 * rooms allotted to RSVP parties. Shared rooms are allowed (families often
 * share) but the response flags who else is in the room so double-booking is
 * visible to the hospitality team.
 */

type AccommodationInput = z.output<typeof accommodationInputSchema>;
type RoomInput = z.output<typeof roomAssignmentInputSchema>;

const roomInclude = { accommodation: { select: { name: true } } } as const;

async function withSharing(room: Parameters<typeof toRoomDTO>[0]): Promise<RoomAssignmentDTO> {
  const others = await prisma.roomAssignment.findMany({
    where: { accommodationId: room.accommodationId, roomNumber: room.roomNumber, id: { not: room.id } },
    include: { rsvp: { select: { guestName: true } } },
  });
  return { ...toRoomDTO(room), sharedWith: others.map((o) => o.rsvp.guestName) };
}

function toDates(input: RoomInput) {
  return {
    roomNumber: input.roomNumber,
    notes: input.notes,
    checkIn: input.checkIn ? new Date(input.checkIn) : null,
    checkOut: input.checkOut ? new Date(input.checkOut) : null,
  };
}

export const roomsService = {
  async listAccommodations(): Promise<AccommodationDTO[]> {
    const rows = await prisma.accommodation.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { rooms: true } } },
    });
    return rows.map(toAccommodationDTO);
  },

  async createAccommodation(input: AccommodationInput): Promise<AccommodationDTO> {
    return toAccommodationDTO(await prisma.accommodation.create({ data: input }));
  },

  async updateAccommodation(id: string, input: AccommodationInput): Promise<AccommodationDTO> {
    if (!(await prisma.accommodation.findUnique({ where: { id } }))) throw notFound('Accommodation');
    return toAccommodationDTO(
      await prisma.accommodation.update({ where: { id }, data: input, include: { _count: { select: { rooms: true } } } }),
    );
  },

  async removeAccommodation(id: string): Promise<void> {
    if (!(await prisma.accommodation.findUnique({ where: { id } }))) throw notFound('Accommodation');
    await prisma.accommodation.delete({ where: { id } });
  },

  async assign(input: RoomInput): Promise<RoomAssignmentDTO> {
    const [rsvp, accommodation] = await Promise.all([
      prisma.rsvp.findUnique({ where: { id: input.rsvpId } }),
      prisma.accommodation.findUnique({ where: { id: input.accommodationId } }),
    ]);
    if (!rsvp) throw notFound('RSVP');
    if (!accommodation) throw badRequest('That accommodation no longer exists', { fields: { accommodationId: 'Choose where the room is' } });
    const room = await prisma.roomAssignment.create({
      data: { rsvpId: input.rsvpId, accommodationId: input.accommodationId, ...toDates(input) },
      include: roomInclude,
    });
    return withSharing(room);
  },

  async updateRoom(id: string, input: RoomInput): Promise<RoomAssignmentDTO> {
    if (!(await prisma.roomAssignment.findUnique({ where: { id } }))) throw notFound('Room assignment');
    const room = await prisma.roomAssignment.update({
      where: { id },
      data: { accommodationId: input.accommodationId, ...toDates(input) },
      include: roomInclude,
    });
    return withSharing(room);
  },

  async removeRoom(id: string): Promise<void> {
    if (!(await prisma.roomAssignment.findUnique({ where: { id } }))) throw notFound('Room assignment');
    await prisma.roomAssignment.delete({ where: { id } });
  },

  /** Everything the hospitality team needs on one screen: rooms per hotel + parties still without a room. */
  async board(): Promise<RoomBoardDTO> {
    const [accommodations, unassigned] = await Promise.all([
      prisma.accommodation.findMany({
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        include: {
          _count: { select: { rooms: true } },
          rooms: {
            include: { accommodation: { select: { name: true } }, rsvp: { select: { guestName: true, numberOfGuests: true, side: true } } },
            orderBy: { roomNumber: 'asc' },
          },
        },
      }),
      prisma.rsvp.findMany({
        where: { attendanceStatus: { not: 'DECLINED' }, rooms: { none: {} } },
        select: { id: true, guestName: true, numberOfGuests: true, side: true, attendanceStatus: true },
        orderBy: { guestName: 'asc' },
      }),
    ]);
    return {
      accommodations: accommodations.map((a) => ({
        ...toAccommodationDTO(a),
        rooms: a.rooms.map((r) => {
          const shared = a.rooms.filter((o) => o.roomNumber === r.roomNumber && o.id !== r.id).map((o) => o.rsvp.guestName);
          return { ...toRoomDTO(r), sharedWith: shared, guestName: r.rsvp.guestName, numberOfGuests: r.rsvp.numberOfGuests, side: r.rsvp.side };
        }),
      })),
      unassigned,
    };
  },
};
