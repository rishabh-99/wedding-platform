import ExcelJS from 'exceljs';
import {
  ATTENDANCE_LABELS,
  SIDE_LABELS,
  formatDateTime,
  localDateKey,
  type GuestSide,
} from '@wedding/shared';
import { prisma } from '../lib/prisma';
import { rsvpService } from './rsvp.service';
import { settingsService } from './settings.service';

type RsvpRow = Awaited<ReturnType<typeof rsvpService.all>>[number];

const MAROON = 'FF6B1E2A';
const IVORY = 'FFFBF7EE';
const GOLD = 'FFA8894F';

/** Excel forbids : \ / ? * [ ] in sheet names and limits them to 31 chars. */
export function sheetName(name: string, used: Set<string>): string {
  let base = name.replace(/\s*\/\s*/g, ' & ').replace(/[:\\/?*[\]]/g, '-').slice(0, 31).trim() || 'Sheet';
  let candidate = base;
  let i = 2;
  while (used.has(candidate.toLowerCase())) candidate = `${base.slice(0, 28)} ${i++}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

function styleHeader(ws: ExcelJS.Worksheet) {
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: IVORY } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAROON } };
  header.alignment = { vertical: 'middle' };
  header.height = 22;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function autoWidth(ws: ExcelJS.Worksheet, min = 10, max = 60) {
  ws.columns.forEach((col) => {
    let width = min;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const text = cell.value == null ? '' : typeof cell.value === 'object' && 'formula' in cell.value ? '00000' : String(cell.value);
      const longest = text.split('\n').reduce((m, l) => Math.max(m, l.length), 0);
      width = Math.max(width, longest + 2);
    });
    col.width = Math.min(width, max);
  });
}

function addTotalsRow(ws: ExcelJS.Worksheet, guestsColumnLetter: string, labelColumn = 1) {
  const last = ws.rowCount;
  const row = ws.addRow([]);
  row.getCell(labelColumn).value = 'Total guests';
  row.getCell(guestsColumnLetter).value = last > 1 ? { formula: `SUBTOTAL(9,${guestsColumnLetter}2:${guestsColumnLetter}${last})`, result: undefined } : 0;
  row.font = { bold: true };
  row.border = { top: { style: 'thin', color: { argb: GOLD } } };
}

interface RsvpSheetColumn {
  header: string;
  key: string;
  value: (r: RsvpRow) => string | number | null;
}

function writeRsvpSheet(ws: ExcelJS.Worksheet, rows: RsvpRow[], columns: RsvpSheetColumn[]) {
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key }));
  for (const r of rows) ws.addRow(Object.fromEntries(columns.map((c) => [c.key, c.value(r)])));
  styleHeader(ws);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: columns.length } };
  const guestsIndex = columns.findIndex((c) => c.key === 'guests');
  if (guestsIndex >= 0) addTotalsRow(ws, ws.getColumn(guestsIndex + 1).letter);
  autoWidth(ws);
  const messageIndex = columns.findIndex((c) => c.key === 'message');
  if (messageIndex >= 0) ws.getColumn(messageIndex + 1).alignment = { wrapText: true, vertical: 'top' };
}

/**
 * Builds the RSVP workbook: All RSVPs, Summary, and one sheet per celebration.
 * Events on the final wedding day are grouped into a single "Wedding" sheet
 * (Sehra-Bandhi, Baraat, Jaimal & Phere) — derived from the schedule, not hardcoded.
 */
export async function buildRsvpWorkbook(): Promise<ExcelJS.Workbook> {
  const settings = await settingsService.get();
  const tz = settings.timezone;
  const [rsvps, events] = await Promise.all([
    rsvpService.all(),
    prisma.event.findMany({ orderBy: { startDateTime: 'asc' } }),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = `${settings.coupleName1} & ${settings.coupleName2}`;
  wb.created = new Date();
  const used = new Set<string>();

  const baseColumns: RsvpSheetColumn[] = [
    { header: 'Guest name', key: 'name', value: (r) => r.guestName },
    { header: 'Phone', key: 'phone', value: (r) => r.phone },
    { header: 'Email', key: 'email', value: (r) => r.email ?? '' },
    { header: 'Guests', key: 'guests', value: (r) => r.numberOfGuests },
    { header: 'Side', key: 'side', value: (r) => (r.side ? SIDE_LABELS[r.side] : '') },
    { header: 'Attendance', key: 'status', value: (r) => ATTENDANCE_LABELS[r.attendanceStatus] },
    { header: 'Rooms', key: 'rooms', value: (r) => r.rooms.map((room) => `${room.accommodation.name} ${room.roomNumber}`).join(', ') },
  ];
  const tail: RsvpSheetColumn[] = [
    { header: 'Message', key: 'message', value: (r) => r.message ?? '' },
    { header: 'Submitted', key: 'submitted', value: (r) => formatDateTime(r.submittedAt, tz) },
    { header: 'Last updated', key: 'updated', value: (r) => formatDateTime(r.updatedAt, tz) },
  ];
  const eventsColumn: RsvpSheetColumn = {
    header: 'Celebrations',
    key: 'events',
    value: (r) =>
      [...r.events]
        .sort((a, b) => a.event.startDateTime.getTime() - b.event.startDateTime.getTime())
        .map((e) => e.event.name)
        .join(', '),
  };

  // Sheet 1 — All RSVPs
  writeRsvpSheet(wb.addWorksheet(sheetName('All RSVPs', used)), rsvps, [...baseColumns, eventsColumn, ...tail]);

  // Sheet 2 — Summary
  const summary = wb.addWorksheet(sheetName('Summary', used));
  summary.columns = [
    { header: 'Metric', key: 'metric' },
    { header: 'Responses', key: 'responses' },
    { header: 'Guests', key: 'guests' },
  ];
  const sum = (list: RsvpRow[]) => list.reduce((acc, r) => acc + r.numberOfGuests, 0);
  const by = (status: RsvpRow['attendanceStatus']) => rsvps.filter((r) => r.attendanceStatus === status);
  summary.addRow({ metric: 'Total responses', responses: rsvps.length, guests: sum(rsvps) });
  summary.addRow({ metric: 'Attending', responses: by('ATTENDING').length, guests: sum(by('ATTENDING')) });
  summary.addRow({ metric: 'Maybe', responses: by('MAYBE').length, guests: sum(by('MAYBE')) });
  summary.addRow({ metric: 'Unable to attend', responses: by('DECLINED').length, guests: 0 });
  summary.addRow({});
  const sideHeader = summary.addRow({ metric: 'By side (attending + maybe)', responses: 'Responses', guests: 'Guests' });
  sideHeader.font = { bold: true, color: { argb: MAROON } };
  for (const side of [...(Object.keys(SIDE_LABELS) as GuestSide[]), null]) {
    const list = rsvps.filter((r) => r.attendanceStatus !== 'DECLINED' && r.side === side);
    if (side === null && !list.length) continue;
    summary.addRow({ metric: side ? SIDE_LABELS[side] : 'Side not specified', responses: list.length, guests: sum(list) });
  }
  const roomsTotal = rsvps.reduce((n, r) => n + r.rooms.length, 0);
  const needRooms = rsvps.filter((r) => r.attendanceStatus !== 'DECLINED' && r.rooms.length === 0);
  summary.addRow({ metric: 'Rooms allotted', responses: roomsTotal });
  summary.addRow({ metric: 'Parties still without a room', responses: needRooms.length, guests: sum(needRooms) });
  summary.addRow({});
  const eventHeader = summary.addRow({ metric: 'Attendance by celebration (attending + maybe)', responses: 'Responses', guests: 'Guests' });
  eventHeader.font = { bold: true, color: { argb: MAROON } };
  for (const event of events) {
    const list = rsvps.filter((r) => r.attendanceStatus !== 'DECLINED' && r.events.some((e) => e.eventId === event.id));
    summary.addRow({ metric: `${event.name} — ${formatDateTime(event.startDateTime, tz)}`, responses: list.length, guests: sum(list) });
  }
  summary.addRow({});
  summary.addRow({ metric: `Generated ${formatDateTime(new Date(), tz)} (${tz})` }).font = { italic: true, color: { argb: 'FF7A6A5E' } };
  styleHeader(summary);
  summary.autoFilter = { from: 'A1', to: 'C1' };
  autoWidth(summary);

  // Sheets 3+ — per celebration; the final day's events share one "Wedding" sheet.
  const lastDay = events.length ? localDateKey(events[events.length - 1]!.startDateTime, tz) : null;
  const finalDayEvents = events.filter((e) => localDateKey(e.startDateTime, tz) === lastDay);
  const groups: { name: string; eventIds: string[] }[] = [];
  for (const event of events) {
    if (finalDayEvents.length > 1 && finalDayEvents.includes(event)) continue;
    groups.push({ name: event.name, eventIds: [event.id] });
  }
  if (finalDayEvents.length > 1) groups.push({ name: 'Wedding', eventIds: finalDayEvents.map((e) => e.id) });

  for (const group of groups) {
    const list = rsvps.filter((r) => r.attendanceStatus !== 'DECLINED' && r.events.some((e) => group.eventIds.includes(e.eventId)));
    const cols = group.eventIds.length > 1
      ? [...baseColumns, {
          ...eventsColumn,
          value: (r: RsvpRow) =>
            r.events.filter((e) => group.eventIds.includes(e.eventId)).map((e) => e.event.name).join(', '),
        }, ...tail]
      : [...baseColumns, ...tail];
    writeRsvpSheet(wb.addWorksheet(sheetName(group.name, used)), list, cols);
  }

  // Final sheet — room allotment, one row per room, sorted by hotel then room number.
  const roomsSheet = wb.addWorksheet(sheetName('Rooms', used));
  roomsSheet.columns = [
    { header: 'Accommodation', key: 'hotel' },
    { header: 'Room', key: 'room' },
    { header: 'Guest name', key: 'name' },
    { header: 'Guests', key: 'guests' },
    { header: 'Side', key: 'side' },
    { header: 'Phone', key: 'phone' },
    { header: 'Check-in', key: 'in' },
    { header: 'Check-out', key: 'out' },
    { header: 'Notes', key: 'notes' },
  ];
  const roomRows = rsvps
    .flatMap((r) => r.rooms.map((room) => ({ r, room })))
    .sort((a, b) => a.room.accommodation.name.localeCompare(b.room.accommodation.name) || a.room.roomNumber.localeCompare(b.room.roomNumber, undefined, { numeric: true }));
  for (const { r, room } of roomRows) {
    roomsSheet.addRow({
      hotel: room.accommodation.name,
      room: room.roomNumber,
      name: r.guestName,
      guests: r.numberOfGuests,
      side: r.side ? SIDE_LABELS[r.side] : '',
      phone: r.phone,
      in: room.checkIn ? formatDateTime(room.checkIn, tz) : '',
      out: room.checkOut ? formatDateTime(room.checkOut, tz) : '',
      notes: room.notes ?? '',
    });
  }
  styleHeader(roomsSheet);
  roomsSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, roomRows.length + 1), column: 9 } };
  autoWidth(roomsSheet);

  return wb;
}
