import type { DashboardDTO } from '@wedding/shared';
import { prisma } from '../lib/prisma';
import { eventService } from './event.service';
import { toRsvpDTO } from './mappers';
import { rsvpInclude } from './rsvp.service';

export const dashboardService = {
  async get(): Promise<DashboardDTO> {
    const [schedule, events, statusGroups, photos, videos, livePosts, guestbookTotal, pendingGuestbook, attendance, recent] =
      await Promise.all([
        eventService.schedule(),
        prisma.event.findMany({ orderBy: { startDateTime: 'asc' }, select: { id: true, name: true } }),
        prisma.rsvp.groupBy({ by: ['attendanceStatus'], _count: { _all: true }, _sum: { numberOfGuests: true } }),
        prisma.mediaAsset.count({ where: { type: 'IMAGE', purpose: { in: ['GALLERY', 'LIVE'] } } }),
        prisma.mediaAsset.count({ where: { type: 'VIDEO' } }),
        prisma.liveUpdate.count({ where: { published: true } }),
        prisma.guestbookMessage.count(),
        prisma.guestbookMessage.count({ where: { status: 'PENDING' } }),
        prisma.$queryRaw<{ eventId: string; responses: bigint; guests: bigint | null }[]>`
          SELECT re."eventId", COUNT(*)::bigint AS responses, SUM(r."numberOfGuests")::bigint AS guests
          FROM "RsvpEvent" re JOIN "Rsvp" r ON r.id = re."rsvpId"
          WHERE r."attendanceStatus" <> 'DECLINED'
          GROUP BY re."eventId"`,
        prisma.rsvp.findMany({ include: rsvpInclude, orderBy: { submittedAt: 'desc' }, take: 5 }),
      ]);
    const [sides, roomsAssigned, partiesNeedingRooms] = await Promise.all([
      prisma.rsvp.groupBy({
        by: ['side'],
        where: { attendanceStatus: { not: 'DECLINED' } },
        _count: { _all: true },
        _sum: { numberOfGuests: true },
      }),
      prisma.roomAssignment.count(),
      prisma.rsvp.count({ where: { attendanceStatus: { not: 'DECLINED' }, rooms: { none: {} } } }),
    ]);

    const status = (s: string) => statusGroups.find((g) => g.attendanceStatus === s);
    const attendanceMap = new Map(attendance.map((a) => [a.eventId, a]));

    return {
      liveNow: schedule.current ? { id: schedule.current.id, name: schedule.current.name, slug: schedule.current.slug } : null,
      nextEvent: schedule.next
        ? { id: schedule.next.id, name: schedule.next.name, slug: schedule.next.slug, startDateTime: schedule.next.startDateTime }
        : null,
      phase: schedule.phase,
      counts: {
        events: events.length,
        rsvps: statusGroups.reduce((a, g) => a + g._count._all, 0),
        confirmedResponses: status('ATTENDING')?._count._all ?? 0,
        confirmedGuests: status('ATTENDING')?._sum.numberOfGuests ?? 0,
        maybeResponses: status('MAYBE')?._count._all ?? 0,
        maybeGuests: status('MAYBE')?._sum.numberOfGuests ?? 0,
        declined: status('DECLINED')?._count._all ?? 0,
        totalGuests: (status('ATTENDING')?._sum.numberOfGuests ?? 0) + (status('MAYBE')?._sum.numberOfGuests ?? 0),
        photos,
        videos,
        livePosts,
        guestbookTotal,
        pendingGuestbook,
      },
      attendancePerEvent: events.map((e) => ({
        eventId: e.id,
        name: e.name,
        responses: Number(attendanceMap.get(e.id)?.responses ?? 0),
        guests: Number(attendanceMap.get(e.id)?.guests ?? 0),
      })),
      sides: sides.map((s) => ({ side: s.side, responses: s._count._all, guests: s._sum.numberOfGuests ?? 0 })),
      rooms: { assigned: roomsAssigned, partiesNeedingRooms },
      recentRsvps: recent.map(toRsvpDTO),
    };
  },
};
