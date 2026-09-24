/**
 * Idempotent seed.
 *  - Core data (always, on an empty database): admin user, settings, the six
 *    real celebrations, venues, story, travel, FAQ, gallery albums.
 *  - Demo data (development only, SEED_DEMO_DATA=true): sample RSVPs, live
 *    posts, guestbook messages and generated placeholder photographs.
 * Re-running is safe: if settings already exist the seed exits without changes.
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { DEFAULT_SECTIONS, parseLocalDateTime } from '@wedding/shared';
import { env, DEV_DEFAULT_ADMIN_PASSWORD } from '../src/config/env';
import { hashPassword } from '../src/services/auth.service';
import { mediaService } from '../src/services/media.service';
import { normalizePhone } from '../src/services/rsvp.service';
import { PALETTES, renderArt } from './seed-art';

const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
const TZ = 'Asia/Kolkata';
const at = (local: string) => parseLocalDateTime(local, TZ);
const seedDemo = (process.env.SEED_DEMO_DATA ?? (env.isProd ? 'false' : 'true')) === 'true';

async function seedCore() {
  const adminPassword = env.SEED_ADMIN_PASSWORD;
  if (env.isProd && adminPassword === DEV_DEFAULT_ADMIN_PASSWORD) {
    throw new Error('Set SEED_ADMIN_PASSWORD to a strong password before seeding production.');
  }
  await prisma.user.upsert({
    where: { email: env.SEED_ADMIN_EMAIL },
    update: {},
    create: { email: env.SEED_ADMIN_EMAIL, name: 'Wedding Admin', role: 'ADMIN', passwordHash: await hashPassword(adminPassword) },
  });

  await prisma.weddingSettings.create({
    data: {
      id: 'default',
      coupleName1: 'Rishabh',
      coupleName2: 'Nandita',
      familiesLine: 'Together with their families',
      inviteLine: 'invite you to celebrate their wedding',
      welcomeMessage:
        'With joy in our hearts and our families beside us, we would be honoured to have you with us as we begin our life together.',
      weddingDatesLabel: '20 October 2026 · 3–4 December 2026',
      weddingHashtag: '#RishabhWedsNandita',
      timezone: TZ,
      contactPhone: '+91 90000 00000',
      contactWhatsapp: '+91 90000 00000',
      contactEmail: 'hello@example.com',
      whatsappGroupUrl: 'https://chat.whatsapp.com/SampleInviteCode123',
      siteTitle: 'Rishabh & Nandita · The Wedding',
      siteDescription: 'Together with their families, Rishabh & Nandita invite you to celebrate their wedding · Kanpur · 3–4 December 2026',
      sections: DEFAULT_SECTIONS as unknown as Prisma.InputJsonValue,
      liveMode: 'AUTO',
      liveBannerText: 'The celebrations have begun',
    },
  });

  const moonMars = await prisma.venue.create({
    data: {
      name: 'Moon & Mars',
      mapsUrl: 'https://maps.app.goo.gl/C1vZtGZmPn8UDBMo9',
      address: 'Full address to be added by the hosts',
      description: 'An intimate setting for the ring ceremony.',
      parkingInformation: 'Parking details will be shared closer to the date.',
      nearbyLandmarks: 'Landmarks to be added.',
      transportInformation: 'Cabs and autos are readily available. Tap “Get Directions” for the exact pin.',
      contactInformation: 'For help finding the venue, call the family contact listed under “Need Help?”.',
      displayOrder: 1,
    },
  });
  const statusClub = await prisma.venue.create({
    data: {
      name: 'Status Club Kanpur',
      mapsUrl: 'https://share.google/WNdAo3dcJVuN6znho',
      address: 'Status Club, Kanpur, Uttar Pradesh — full address to be added',
      description: 'The home of our wedding celebrations — Haldi & Mehendi, Sangeet, Sehra-Bandhi, Baraat and the Jaimal & Phere.',
      parkingInformation: 'On-site parking is available for guests. Valet details to follow.',
      nearbyLandmarks: 'Landmarks to be added.',
      transportInformation: 'About 20–30 minutes from Kanpur Central by car, depending on traffic.',
      contactInformation: 'Venue coordinator details will be added here.',
      displayOrder: 2,
    },
  });

  const events: Prisma.EventUncheckedCreateInput[] = [
    {
      name: 'Engagement',
      slug: 'engagement',
      startDateTime: at('2026-10-20T11:00'),
      venueId: moonMars.id,
      description: 'The first promise. An intimate morning as we exchange rings, surrounded by the people who made us who we are.',
      dressCode: 'Indo-Western Elegance',
      dressCodeDescription: 'Think refined and celebratory — soft pastels, champagne and ivory tones. Sarees, lehengas, bandhgalas or sharp suits are all perfect.',
      dressPalette: [
        { name: 'Champagne', hex: '#E8D5B0' },
        { name: 'Blush', hex: '#E7C3BC' },
        { name: 'Ivory', hex: '#FBF7EE' },
        { name: 'Sage', hex: '#B7C2A5' },
      ],
      helpfulInfo: 'The ceremony begins promptly at 11:00 AM, followed by lunch.',
      displayOrder: 1,
    },
    {
      name: 'Haldi / Mehendi',
      slug: 'haldi-mehendi',
      startDateTime: at('2026-12-03T09:00'),
      venueId: statusClub.id,
      description: 'A sun-soaked morning of turmeric, laughter and henna — music, marigolds and the first colours of the wedding.',
      dressCode: 'Sunshine Yellows & Garden Greens',
      dressCodeDescription: 'Light cottons and comfortable fabrics you do not mind getting a little haldi on. Florals and mirror-work welcome.',
      dressPalette: [
        { name: 'Marigold', hex: '#E9A23B' },
        { name: 'Turmeric', hex: '#E4B53C' },
        { name: 'Leaf Green', hex: '#6E8B3D' },
        { name: 'Mint', hex: '#BFD8B8' },
      ],
      helpfulInfo: 'Expect some colour! Mehendi artists will be available throughout the morning.',
      displayOrder: 2,
    },
    {
      name: 'Sangeet',
      slug: 'sangeet',
      startDateTime: at('2026-12-03T21:00'),
      venueId: statusClub.id,
      description: 'An evening of music, performances and dancing late into the night, as both families take to the floor.',
      dressCode: 'Evening Glamour',
      dressCodeDescription: 'Sequins, shimmer and statement pieces. Jewel tones and metallics are encouraged.',
      dressPalette: [
        { name: 'Midnight', hex: '#1E2238' },
        { name: 'Emerald', hex: '#1F5C4A' },
        { name: 'Antique Gold', hex: '#A8894F' },
        { name: 'Wine', hex: '#6B1E2A' },
      ],
      helpfulInfo: 'Performances begin shortly after 9:30 PM. Dinner will be served through the evening.',
      displayOrder: 3,
    },
    {
      name: 'Sehra-Bandhi',
      slug: 'sehra-bandhi',
      startDateTime: at('2026-12-04T08:00'),
      venueId: statusClub.id,
      description: 'The tying of the sehra — a quiet, deeply traditional moment as the groom is blessed by his family before the baraat.',
      dressCode: 'Traditional Indian',
      dressCodeDescription: 'Kurtas, sherwanis, sarees and suits in warm festive tones.',
      dressPalette: [
        { name: 'Saffron', hex: '#E08A2E' },
        { name: 'Cream', hex: '#F4ECDB' },
        { name: 'Gold', hex: '#C2A56B' },
      ],
      displayOrder: 4,
    },
    {
      name: 'Baraat',
      slug: 'baraat',
      startDateTime: at('2026-12-04T09:00'),
      venueId: statusClub.id,
      description: 'The groom’s procession arrives with the dhol — join us to dance the baraat all the way in.',
      dressCode: 'Festive Traditional',
      dressCodeDescription: 'Bright, festive colours and comfortable shoes — there will be dancing!',
      dressPalette: [
        { name: 'Fuchsia', hex: '#B8336A' },
        { name: 'Marigold', hex: '#E9A23B' },
        { name: 'Peacock', hex: '#1F6F78' },
      ],
      helpfulInfo: 'Safas (turbans) will be tied for the groom’s side from 8:30 AM.',
      displayOrder: 5,
    },
    {
      name: 'Jaimal & Phere',
      slug: 'jaimal-phere',
      startDateTime: at('2026-12-04T11:00'),
      venueId: statusClub.id,
      description: 'The exchange of garlands, followed by the seven sacred pheras around the fire — the heart of the wedding.',
      dressCode: 'Traditional Indian Formal',
      dressCodeDescription: 'Your finest traditional attire. We kindly ask guests to avoid wearing bridal red.',
      dressPalette: [
        { name: 'Deep Maroon', hex: '#6B1E2A' },
        { name: 'Antique Gold', hex: '#A8894F' },
        { name: 'Ivory', hex: '#FBF7EE' },
        { name: 'Rose', hex: '#C98B83' },
      ],
      helpfulInfo: 'The ceremony lasts around two hours. Lunch follows the pheras.',
      displayOrder: 6,
    },
  ];
  for (const e of events) await prisma.event.create({ data: e });

  const bySlug = Object.fromEntries((await prisma.event.findMany()).map((e) => [e.slug, e.id]));
  const albums = [
    { name: 'Engagement', slug: 'engagement', eventId: bySlug['engagement'] },
    { name: 'Haldi', slug: 'haldi', eventId: bySlug['haldi-mehendi'] },
    { name: 'Mehendi', slug: 'mehendi', eventId: bySlug['haldi-mehendi'] },
    { name: 'Sangeet', slug: 'sangeet', eventId: bySlug['sangeet'] },
    { name: 'Sehra-Bandhi', slug: 'sehra-bandhi', eventId: bySlug['sehra-bandhi'] },
    { name: 'Baraat', slug: 'baraat', eventId: bySlug['baraat'] },
    { name: 'Jaimal', slug: 'jaimal', eventId: bySlug['jaimal-phere'] },
    { name: 'Phere', slug: 'phere', eventId: bySlug['jaimal-phere'] },
  ];
  for (const [i, a] of albums.entries()) await prisma.album.create({ data: { ...a, displayOrder: i + 1 } });

  const story = [
    {
      key: 'how-we-met',
      eyebrow: 'Chapter One',
      title: 'How we met',
      body: 'It began, as the best things often do, without either of us noticing. A shared table, a long conversation, and the quiet sense that we had known each other for much longer than an evening.',
    },
    {
      key: 'our-story',
      eyebrow: 'Chapter Two',
      title: 'Our story',
      body: 'Over the years that followed there were cities and seasons, long calls and longer drives, and a slowly dawning certainty. Somewhere along the way, our two families began to feel like one.',
    },
    {
      key: 'engagement',
      eyebrow: 'Chapter Three',
      title: 'The engagement',
      body: 'On the twentieth of October, with our families beside us, we exchange rings at Moon & Mars — a small promise before the larger one.',
    },
    {
      key: 'wedding-journey',
      eyebrow: 'Chapter Four',
      title: 'The wedding journey',
      body: 'And then, in Kanpur, two days of haldi and henna, music and dancing, the sehra and the baraat, and finally the seven pheras. We cannot imagine them without you.',
    },
  ];
  for (const [i, s] of story.entries()) await prisma.storySection.create({ data: { ...s, displayOrder: i + 1 } });

  const travel = [
    {
      category: 'getting-there',
      title: 'Getting to Kanpur',
      body: 'Kanpur is well connected by rail, road and air. Most guests arrive by train into Kanpur Central or fly into Lucknow and drive down — around two hours by car.',
    },
    {
      category: 'airport',
      title: 'Airports',
      body: 'Kanpur Airport (KNU) has limited domestic flights. Chaudhary Charan Singh International Airport, Lucknow (LKO) has the widest choice and is roughly 90 km from Kanpur. Airport transfers can be arranged — please let us know your flight details.',
      links: [{ label: 'Lucknow Airport', url: 'https://www.google.com/maps/search/?api=1&query=Lucknow+Airport' }],
    },
    {
      category: 'railway',
      title: 'Railway station',
      body: 'Kanpur Central (CNB) is one of the busiest junctions in North India, with direct trains from Delhi, Mumbai, Kolkata and beyond. The Shatabdi and Vande Bharat services from New Delhi take around five hours.',
      links: [{ label: 'Kanpur Central on Maps', url: 'https://www.google.com/maps/search/?api=1&query=Kanpur+Central+Railway+Station' }],
    },
    {
      category: 'local-transport',
      title: 'Getting around',
      body: 'App-based cabs (Uber, Ola) and autos are easy to find across the city. We will also run shuttles between the recommended hotels and Status Club on 3–4 December — timings will be posted here.',
    },
    {
      category: 'stay',
      title: 'Where to stay',
      body: 'We have reserved rooms at a few hotels close to the venue. Please mention the wedding when booking. Hotel names, contacts and booking codes will be added here by the hosts.',
    },
    {
      category: 'hotels',
      title: 'Recommended hotels',
      body: 'Recommended hotels will be listed here with distance to the venue and booking details. (Placeholder — editable in the admin portal under Travel & Stay.)',
    },
    {
      category: 'parking',
      title: 'Parking',
      body: 'Parking is available at both venues. On the wedding day, valet will be available at the main entrance of Status Club.',
    },
    {
      category: 'contacts',
      title: 'Important contacts',
      body: 'Hospitality desk: +91 90000 00000 (placeholder)\nTravel & transfers: +91 90000 00000 (placeholder)\nVenue coordinator: to be added',
    },
  ];
  for (const [i, t] of travel.entries()) {
    await prisma.travelSection.create({ data: { ...t, links: t.links ?? [], displayOrder: i + 1 } });
  }

  const faqs: [string, string][] = [
    ['What time should I arrive?', 'Please arrive around 15–20 minutes before each event’s start time. Every celebration’s time is listed in the itinerary, and the live “What’s Happening Now” panel will always show what is on.'],
    ['Where is each event?', 'The engagement is at Moon & Mars. All December celebrations — Haldi & Mehendi, Sangeet, Sehra-Bandhi, Baraat and the Jaimal & Phere — are at Status Club Kanpur.'],
    ['Where do I get directions?', 'Every event page and the “Find Your Way” section have a one-tap “Get Directions” button that opens Google Maps with the exact location.'],
    ['Is parking available?', 'Yes — parking is available at both venues, with valet at Status Club on the wedding day.'],
    ['What should I wear?', 'Each celebration has its own dress code and colour palette — see “What to Wear”. Comfort matters too: there will be plenty of dancing!'],
    ['Where should I stay?', 'See “Travel & Stay” for recommended hotels near the venue and how to book.'],
    ['Who can I contact?', 'Tap “Need a hand?” at any time to reach the family’s hospitality contacts by phone or WhatsApp.'],
    ['Can I bring a plus one?', 'Please include everyone in your party in the “Number of guests” field on your RSVP. If you are unsure whether your invitation includes a guest, just ask us.'],
    ['Where will photographs appear?', 'Photographs will appear in the Gallery and the live feed during the celebrations, and remain in the Wedding Archive afterwards.'],
    ['Can I add events to my calendar?', 'Yes — every event has an “Add to Calendar” button for Google Calendar, Apple Calendar and Outlook, or you can download an .ics file.'],
  ];
  for (const [i, [question, answer]] of faqs.entries()) {
    await prisma.faqItem.create({ data: { question, answer, displayOrder: i + 1 } });
  }
}

async function seedDemoData() {
  const events = await prisma.event.findMany({ orderBy: { startDateTime: 'asc' } });
  const id = (slug: string) => events.find((e) => e.slug === slug)!.id;
  const albums = await prisma.album.findMany();

  // Placeholder photographs — generated locally and pushed through the real upload pipeline
  // (validation, WebP renditions, thumbnails, storage provider).
  const albumPalettes: Record<string, (keyof typeof PALETTES)[]> = {
    engagement: ['ivory', 'rose', 'saffron', 'ivory'],
    haldi: ['marigold', 'saffron', 'marigold', 'ivory'],
    mehendi: ['henna', 'emerald', 'henna'],
    sangeet: ['midnight', 'maroon', 'emerald', 'midnight', 'maroon'],
    'sehra-bandhi': ['saffron', 'ivory', 'maroon'],
    baraat: ['rose', 'marigold', 'maroon', 'saffron'],
    jaimal: ['rose', 'ivory', 'maroon'],
    phere: ['maroon', 'saffron', 'ivory', 'maroon'],
  };
  const captions = [
    'A quiet moment before the celebrations',
    'Marigolds and morning light',
    'Laughter in the courtyard',
    'Blessings from the elders',
    'The details',
    'Candlelight and music',
    'The dance floor comes alive',
    'Family, together',
  ];
  let seed = 7;
  const shapes: [number, number][] = [[1600, 2000], [2000, 1334], [1600, 1600], [1600, 2133], [2000, 1250]];
  for (const album of albums) {
    const palettes = albumPalettes[album.slug] ?? ['ivory'];
    for (const [i, pal] of palettes.entries()) {
      const [w, h] = shapes[(seed + i) % shapes.length]!;
      const buffer = await renderArt(w, h, PALETTES[pal]!, seed++ * 7919);
      await mediaService.upload(
        { buffer, originalname: `${album.slug}-${i + 1}.jpg`, mimetype: 'image/jpeg', size: buffer.length },
        { purpose: 'GALLERY', albumId: album.id, caption: `${captions[(seed + i) % captions.length]} · Sample photograph`, isPublished: true },
      );
    }
  }

  // Live posts — one or more per celebration, timestamped during each event.
  const livePhoto = async (pal: keyof typeof PALETTES, n: number) => {
    const buffer = await renderArt(1800, 1200, PALETTES[pal]!, 90_000 + n);
    const asset = await mediaService.upload(
      { buffer, originalname: `live-${n}.jpg`, mimetype: 'image/jpeg', size: buffer.length },
      { purpose: 'LIVE', isPublished: true },
    );
    return asset.id;
  };
  const posts: { slug: string; at: string; type: 'TEXT' | 'PHOTO' | 'ANNOUNCEMENT'; title?: string; content: string; photo?: keyof typeof PALETTES }[] = [
    { slug: 'engagement', at: '2026-10-20T11:20', type: 'ANNOUNCEMENT', title: 'We are gathered', content: 'Families have arrived and the ring ceremony is about to begin.' },
    { slug: 'engagement', at: '2026-10-20T11:48', type: 'PHOTO', content: 'Rings exchanged. It’s official!', photo: 'rose' },
    { slug: 'haldi-mehendi', at: '2026-12-03T09:35', type: 'PHOTO', content: 'Marigolds, turmeric and a lot of laughter — the Haldi is underway.', photo: 'marigold' },
    { slug: 'haldi-mehendi', at: '2026-12-03T11:10', type: 'TEXT', content: 'Mehendi artists are set up in the garden pavilion — find them by the fountain.' },
    { slug: 'sangeet', at: '2026-12-03T21:18', type: 'TEXT', content: 'The dance floor is officially open!' },
    { slug: 'sangeet', at: '2026-12-03T22:05', type: 'PHOTO', content: 'The families’ performance brought the house down.', photo: 'midnight' },
    { slug: 'sehra-bandhi', at: '2026-12-04T08:20', type: 'PHOTO', content: 'The sehra is tied. Blessings all around.', photo: 'saffron' },
    { slug: 'baraat', at: '2026-12-04T09:05', type: 'ANNOUNCEMENT', title: 'The baraat is moving', content: 'Follow the dhol to the main gate — the baraat is on its way!' },
    { slug: 'jaimal-phere', at: '2026-12-04T11:25', type: 'PHOTO', content: 'Garlands exchanged under a shower of petals.', photo: 'rose' },
    { slug: 'jaimal-phere', at: '2026-12-04T12:40', type: 'TEXT', content: 'Seven pheras, seven promises. Rishabh & Nandita are married.' },
  ];
  for (const [i, p] of posts.entries()) {
    await prisma.liveUpdate.create({
      data: {
        eventId: id(p.slug),
        type: p.type,
        title: p.title ?? null,
        content: p.content,
        mediaAssetId: p.photo ? await livePhoto(p.photo, i) : null,
        published: true,
        publishedAt: at(p.at),
      },
    });
  }
  // One draft and one scheduled post so the admin screens have every state.
  await prisma.liveUpdate.create({
    data: { eventId: id('sangeet'), type: 'TEXT', content: 'Dinner is now being served on the lawn. (Draft)', published: false },
  });
  await prisma.liveUpdate.create({
    data: {
      eventId: id('jaimal-phere'),
      type: 'ANNOUNCEMENT',
      title: 'Lunch is served',
      content: 'Lunch is now being served in the main hall. (Scheduled)',
      published: false,
      scheduledFor: at('2026-12-04T13:30'),
    },
  });

  // Sample RSVPs
  const names: [string, string, number, 'ATTENDING' | 'MAYBE' | 'DECLINED', string[], string?][] = [
    ['Aarav Mehta', '+91 98100 11001', 2, 'ATTENDING', ['engagement', 'sangeet', 'jaimal-phere'], 'So happy for you both!'],
    ['Ananya Sharma', '+91 98100 11002', 1, 'ATTENDING', ['haldi-mehendi', 'sangeet', 'baraat', 'jaimal-phere']],
    ['Vikram & Priya Kapoor', '+91 98100 11003', 2, 'ATTENDING', ['sangeet', 'baraat', 'jaimal-phere'], 'Can’t wait to dance at the sangeet.'],
    ['Rohan Gupta', '+91 98100 11004', 4, 'ATTENDING', ['engagement', 'haldi-mehendi', 'sangeet', 'sehra-bandhi', 'baraat', 'jaimal-phere']],
    ['Kavya Iyer', '+91 98100 11005', 1, 'MAYBE', ['sangeet', 'jaimal-phere'], 'Trying to move a work trip!'],
    ['Siddharth Rao', '+91 98100 11006', 2, 'ATTENDING', ['baraat', 'jaimal-phere']],
    ['Meera Joshi', '+91 98100 11007', 3, 'ATTENDING', ['haldi-mehendi', 'sangeet', 'jaimal-phere']],
    ['Arjun Malhotra', '+91 98100 11008', 1, 'DECLINED', [], 'Sending all our love from London.'],
    ['Ishita Bansal', '+91 98100 11009', 2, 'ATTENDING', ['engagement', 'jaimal-phere']],
    ['Kabir Singh', '+91 98100 11010', 5, 'ATTENDING', ['sangeet', 'sehra-bandhi', 'baraat', 'jaimal-phere']],
    ['Tara Nair', '+91 98100 11011', 1, 'MAYBE', ['jaimal-phere']],
    ['Dev Agarwal', '+91 98100 11012', 2, 'ATTENDING', ['haldi-mehendi', 'sangeet', 'jaimal-phere']],
    ['Nisha Verma', '+91 98100 11013', 2, 'ATTENDING', ['engagement', 'sangeet', 'baraat', 'jaimal-phere']],
    ['Aditya Khanna', '+91 98100 11014', 1, 'DECLINED', []],
    ['Sanya Chopra', '+91 98100 11015', 3, 'ATTENDING', ['sangeet', 'jaimal-phere']],
    ['Rahul & Neha Saxena', '+91 98100 11016', 2, 'ATTENDING', ['haldi-mehendi', 'sangeet', 'sehra-bandhi', 'baraat', 'jaimal-phere']],
    ['Pooja Srivastava', '+91 98100 11017', 4, 'MAYBE', ['sangeet', 'jaimal-phere']],
    ['Manish Tiwari', '+91 98100 11018', 2, 'ATTENDING', ['engagement', 'jaimal-phere']],
  ];
  const createdRsvps: { id: string; status: string }[] = [];
  for (const [i, [guestName, phone, n, status, slugs, message]] of names.entries()) {
    const row = await prisma.rsvp.create({
      data: {
        guestName,
        phone,
        side: i % 3 === 0 ? 'BRIDE' : i % 3 === 1 ? 'GROOM' : i % 2 === 0 ? 'BRIDE' : 'GROOM',
        phoneNormalized: normalizePhone(phone),
        email: `${guestName.split(' ')[0]!.toLowerCase()}@example.com`,
        numberOfGuests: status === 'DECLINED' ? 0 : n,
        attendanceStatus: status,
        message: message ?? null,
        submittedAt: new Date(Date.now() - (names.length - i) * 36 * 3600 * 1000),
        events: { create: slugs.map((s) => ({ eventId: id(s) })) },
      },
    });
    createdRsvps.push({ id: row.id, status });
  }

  // Guest accommodation: two hotels, some parties already allotted rooms.
  const hotelA = await prisma.accommodation.create({
    data: {
      name: 'Guest Hotel — Block A (sample)',
      address: 'Placeholder address, Kanpur',
      contactName: 'Front desk',
      contactPhone: '+91 90000 00001',
      notes: 'Block of 20 rooms held for wedding guests (sample data).',
      displayOrder: 1,
    },
  });
  const hotelB = await prisma.accommodation.create({
    data: {
      name: 'Status Club Guest Rooms (sample)',
      address: 'Status Club, Kanpur',
      contactName: 'Club reception',
      contactPhone: '+91 90000 00002',
      displayOrder: 2,
    },
  });
  const attending = createdRsvps.filter((r) => r.status !== 'DECLINED');
  const checkIn = at('2026-12-02T14:00');
  const checkOut = at('2026-12-05T11:00');
  for (const [i, r] of attending.slice(0, 9).entries()) {
    await prisma.roomAssignment.create({
      data: {
        rsvpId: r.id,
        accommodationId: i % 3 === 2 ? hotelB.id : hotelA.id,
        roomNumber: i % 3 === 2 ? `G${i + 1}` : String(201 + i),
        checkIn,
        checkOut,
      },
    });
  }

  // Event managers & helpful contacts (placeholders — edit in Admin → Contacts).
  const contacts: { name: string; role: string; phone: string; whatsapp?: string; event?: string; isPublic?: boolean }[] = [
    { name: 'Event Manager (placeholder)', role: 'Wedding event manager', phone: '+91 90000 00010', whatsapp: '+91 90000 00010' },
    { name: 'Engagement coordinator (placeholder)', role: 'Event manager — Engagement', phone: '+91 90000 00011', event: 'engagement' },
    { name: 'Sangeet coordinator (placeholder)', role: 'Event manager — Sangeet', phone: '+91 90000 00012', event: 'sangeet' },
    { name: 'Hospitality desk (placeholder)', role: 'Rooms & travel', phone: '+91 90000 00013', whatsapp: '+91 90000 00013' },
    { name: 'Decor vendor (placeholder)', role: 'Decor — internal only', phone: '+91 90000 00014', isPublic: false },
  ];
  for (const [i, c] of contacts.entries()) {
    await prisma.contact.create({
      data: {
        name: c.name,
        role: c.role,
        phone: c.phone,
        whatsapp: c.whatsapp ?? null,
        eventId: c.event ? id(c.event) : null,
        isPublic: c.isPublic ?? true,
        displayOrder: i + 1,
      },
    });
  }

  const blessings: [string, string, 'APPROVED' | 'PENDING'][] = [
    ['Nani & Nanaji', 'May your life together be filled with the same warmth you bring to everyone around you. All our blessings, always.', 'APPROVED'],
    ['The Kapoor family', 'Wishing you a lifetime of laughter, adventure and quiet Sunday mornings. We love you both!', 'APPROVED'],
    ['Ananya', 'From college friends to this — I could not be happier. Here’s to forever!', 'APPROVED'],
    ['Rohan & Shruti', 'Congratulations! Save us a spot on the dance floor.', 'APPROVED'],
    ['Kabir', 'Best wishes to the most wonderful couple.', 'PENDING'],
    ['Meera', 'So much love to you both on your big day!', 'PENDING'],
  ];
  for (const [i, [guestName, message, status]] of blessings.entries()) {
    await prisma.guestbookMessage.create({
      data: { guestName, message, status, createdAt: new Date(Date.now() - (blessings.length - i) * 20 * 3600 * 1000) },
    });
  }
}

async function main() {
  const existing = await prisma.weddingSettings.findUnique({ where: { id: 'default' } });
  if (existing) {
    console.log('✓ Database already seeded — skipping.');
    return;
  }
  console.log('Seeding core wedding data…');
  await seedCore();
  if (seedDemo) {
    console.log('Seeding development demo data (sample RSVPs, photographs, live posts, guestbook)…');
    await seedDemoData();
  }
  console.log('✓ Seed complete.');
  if (!env.isProd) {
    console.log('\n  ┌───────────────────────────────────────────────────────────┐');
    console.log(`  │ DEVELOPMENT admin:  ${env.SEED_ADMIN_EMAIL.padEnd(38)}│`);
    console.log(`  │ Password:           ${env.SEED_ADMIN_PASSWORD.padEnd(38)}│`);
    console.log('  │ Change these before deploying to production!              │');
    console.log('  └───────────────────────────────────────────────────────────┘\n');
  }
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
