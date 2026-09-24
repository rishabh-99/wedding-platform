# Rishabh & Nandita — Wedding Website & Wedding Management Platform

A full-stack, Dockerized wedding experience that evolves through three phases **automatically**, driven entirely by the event schedule in the database:

| Phase | When | What guests see |
|---|---|---|
| **Invitation** | before the celebrations | Royal-door intro, invitation, countdown to the next celebration, story, itinerary, venues, travel, dress code, RSVP, concierge |
| **Live companion** | on event days (3–4 Dec, and 20 Oct) | `● LIVE` mode, *What's Happening Now*, realtime posts & photos (no refresh), next-event countdown |
| **Archive** | after the last celebration | *The celebrations have come to a close — but the memories remain*: wedding journal, album, blessings, story — forever at the same URL |

Plus a separate **admin portal** at `/admin` to manage everything: events, venues, live updates, gallery, RSVPs (bride's/groom's side, Excel export) **with room allotment across multiple hotels**, event-manager contacts, guestbook moderation, story, dress code, travel, FAQ, settings, media library and backups.

---

## Contents

1. [Quick start](#1-quick-start)
2. [Architecture](#2-architecture)
3. [Project structure](#3-project-structure)
4. [Environment variables](#4-environment-variables)
5. [Database, migrations & seed data](#5-database-migrations--seed-data)
6. [Media storage (local & S3)](#6-media-storage-local--s3)
7. [Realtime (SSE)](#7-realtime-sse)
8. [Testing](#8-testing)
9. [Deploying to AWS — step by step](#9-deploying-to-aws--step-by-step)
10. [Backups & restore](#10-backups--restore)
11. [Operating the site](#11-operating-the-site-updates-logs-previewing-phases)
12. [Troubleshooting](#12-troubleshooting)
13. [Production security checklist](#13-production-security-checklist)

---

## 1. Quick start

Requirements: **Docker Desktop** (or Docker Engine + Compose v2). Nothing else — no `.env`, no AWS account, no API keys.

```bash
git clone <repository> wedding-platform
cd wedding-platform
docker compose up
```

The first start builds the image (a few minutes), then automatically:

1. starts PostgreSQL,
2. applies database migrations,
3. seeds realistic demo data (the six real celebrations, both venues, ~30 generated photographs, 18 sample RSVPs, live posts, guestbook messages, story, travel & FAQ),
4. starts the API and the frontend.

| | URL |
|---|---|
| Guest website | http://localhost:3000 |
| Admin portal | http://localhost:3000/admin |
| API health | http://localhost:4000/api/health |

**Development admin login** — `admin@wedding.local` / `ChangeMe!2026`

> ⚠️ These credentials exist **only** in development. Production refuses to seed with the default password — you choose a real one in `.env`.

Development uses: PostgreSQL in Docker · local-disk media (Docker volume) · local SSE · emails written to the backend log (`docker compose logs -f backend`).

To start over with a fresh database: `docker compose down -v && docker compose up`.

### Running without Docker (optional)

```bash
npm install
docker compose up -d db                 # just Postgres (exposed on localhost:55432)
set DATABASE_URL=postgresql://wedding:wedding@localhost:55432/wedding?schema=public   # PowerShell: $env:DATABASE_URL="…"
npm run migrate:deploy -w backend && npm run seed -w backend
npm run dev -w backend                  # API on :4000
npm run dev -w frontend                 # site on :3000 (proxies /api to :4000)
```

---

## 2. Architecture

```text
             Browser (guests on WhatsApp / mobile, admins)
                               │  HTTPS
                               ▼
┌──────────────────────── EC2 instance ────────────────────────┐
│  nginx  ── TLS (Let's Encrypt), HTTP→HTTPS, gzip, security   │
│    │       headers, request limits, static /assets           │
│    ▼                                                         │
│  app (Node.js 20 · Express · TypeScript)                     │
│    ├─ REST API  /api/*          (zod validation, rate limits)│
│    ├─ SSE       /api/live/stream (realtime broadcasts)       │
│    ├─ Scheduler (scheduled posts, phase changes)             │
│    ├─ SPA shell with OpenGraph tags from the database        │
│    ▼                                                         │
│  PostgreSQL 16 (Prisma ORM, migrations)                      │
└──────────────────────────────┬───────────────────────────────┘
                               ▼
                 Amazon S3 (private bucket, presigned URLs)
```

**Key design decisions**

- **Data-driven schedule.** The frontend never knows there are six events. It asks the API *what events exist* and runs the **shared schedule engine** (`shared/src/schedule.ts`) every second to decide the countdown target, `LIVE` state, *Just happened / Up next / Later*, and when the site becomes the archive. The backend uses the same engine for `/api/schedule`, the dashboard and the scheduler — the logic exists once.
- **Timezone-correct.** Times are stored in UTC and displayed in the wedding timezone (`Asia/Kolkata`, editable in Settings), regardless of a guest's phone settings. The clock is corrected against server time.
- **Storage abstraction.** `StorageProvider` → `LocalStorageProvider` | `S3StorageProvider`, selected by `STORAGE_DRIVER`. Only object keys + metadata are stored in Postgres.
- **Code-split.** The admin portal is a separate lazy-loaded bundle; guests never download it. Guest pages are split per route.
- **Security in depth.** bcrypt (cost 12) passwords, JWT in an `HttpOnly; Secure; SameSite=Strict` cookie, per-session CSRF token, role-based authorisation, helmet/CSP, CORS allow-list, rate limiting, magic-byte upload validation, audit log.

---

## 3. Project structure

```text
wedding-platform/
├── shared/                      # Used by both backend & frontend
│   └── src/  schedule.ts (engine) · time.ts (tz) · calendar.ts (ICS/Google/Outlook)
│             schemas.ts (zod validation) · types.ts (API DTOs) · upload.ts (upload policy)
├── backend/
│   ├── prisma/  schema.prisma · migrations/ · seed.ts · seed-art.ts (placeholder photos)
│   ├── src/
│   │   ├── config/        env.ts (validated configuration)
│   │   ├── controllers/   public.controller.ts · admin.controller.ts
│   │   ├── routes/        public.routes.ts · admin.routes.ts
│   │   ├── services/      event, liveUpdate, media, gallery, rsvp, rsvpExport, guestbook,
│   │   │                  content, settings, dashboard, backup, auth, email, audit, mappers
│   │   ├── repositories/  event.repository.ts
│   │   ├── middleware/    auth (authn/authz/CSRF), rateLimit, upload, errorHandler
│   │   ├── storage/       StorageProvider · LocalStorageProvider · S3StorageProvider
│   │   ├── realtime/      sseBroker.ts · scheduler.ts
│   │   ├── app.ts · server.ts · html.ts (SEO shell)
│   └── test/              API, auth, storage, uploads, live updates, SSE integration
├── frontend/
│   ├── public/            favicon, og-image.jpg (WhatsApp preview), robots.txt
│   └── src/
│       ├── components/    intro (royal doors) · home · events · live · gallery · rsvp
│       │                  guestbook · concierge · sections · ornaments · ui
│       ├── pages/         Home, Event, Gallery, Now, Itinerary, Journal, RSVP, …
│       ├── admin/         Admin portal (separate bundle): pages + components
│       ├── hooks/         useSchedule · useClock · useLiveStream (SSE + fallback polling)
│       ├── layouts/ · services/ · animations/ · styles/ · test/
├── nginx/                 nginx.conf · templates/default.conf.template · snippets/
├── docker/                entrypoint.sh · backup.sh · restore.sh · init-letsencrypt.sh
├── Dockerfile             targets: dev · app (production API) · nginx (production proxy)
├── docker-compose.yml     development
├── docker-compose.prod.yml production
└── .env.example
```

---

## 4. Environment variables

Development needs none. For production, copy `.env.example` to `.env` — every variable is documented inline. The important ones:

| Variable | Required in prod | Description |
|---|---|---|
| `DOMAIN` | ✅ | e.g. `rishabhandnandita.com` (nginx + certificates) |
| `PUBLIC_URL` | ✅ | `https://rishabhandnandita.com` (calendar links, OG tags, CORS) |
| `LETSENCRYPT_EMAIL` | | optional — certificate expiry notices; leave empty to register without an email |
| `POSTGRES_PASSWORD` | ✅ | database password (random) |
| `DATABASE_URL` | ✅ | `postgresql://wedding:<password>@db:5432/wedding?schema=public` |
| `JWT_SECRET` | ✅ | 64+ random chars — `openssl rand -hex 48` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | ✅ | first admin account (created on an empty database) |
| `STORAGE_DRIVER` | | `s3` (recommended) or `local` |
| `S3_BUCKET` / `S3_REGION` | with S3 | bucket name and region, e.g. `ap-south-1` |
| `S3_PREFIX` | | optional key prefix |
| `S3_PUBLIC_BASE_URL` | | optional CloudFront URL instead of presigned URLs |
| `EMAIL_DRIVER` | | `log` or `smtp` (+ `SMTP_*`, `EMAIL_FROM`, `ADMIN_NOTIFY_EMAIL`) for RSVP notifications |
| `BACKUP_S3_URI` | | e.g. `s3://my-wedding-backups/db` for nightly dumps |

The app **refuses to start in production** with a missing/default `JWT_SECRET`, or with `STORAGE_DRIVER=s3` but no bucket. Nothing in `.env` is ever sent to the browser — the frontend only receives public settings.

---

## 5. Database, migrations & seed data

- Schema: `backend/prisma/schema.prisma` (users, audit log, settings, venues, events, albums, media assets, live updates, RSVPs + RSVP↔event join, guestbook, story, travel, FAQ, backups) with foreign keys, cascade/set-null rules and indexes.
- **Development:** migrations run automatically on every container start (`prisma migrate deploy`), followed by the seed (which skips itself if data exists).
- **Production:** the same happens automatically when the `app` container starts. To run manually:
  ```bash
  docker compose -f docker-compose.prod.yml run --rm app sh -c "cd backend && npx prisma migrate deploy"
  ```
- **Creating a new migration** after changing `schema.prisma` (development):
  ```bash
  docker compose exec backend sh -c "cd backend && npx prisma migrate dev --name describe_change"
  ```
  Commit the generated folder in `backend/prisma/migrations/`. Never edit tables by hand.
- **Seed:** core data (admin, settings, the six real events, venues with the given Google Maps links, albums, story, travel, FAQ) is always seeded on an empty database. Demo data (sample RSVPs, photos, posts, guestbook) only when `SEED_DEMO_DATA=true` — the default in development, **off in production**.

---

## 6. Media storage (local & S3)

All media goes through one pipeline (`backend/src/services/media.service.ts`):

1. extension allow-list (jpg, png, webp, heic, avif, mp4, mov, webm, pdf),
2. **magic-byte sniffing** — the file contents must match the extension (an `.exe` renamed to `.jpg` is rejected; SVG/HTML/scripts are never accepted),
3. per-type size limits (images 25 MB, videos 200 MB, guest photos 10 MB) — checked in the browser *before* upload and again on the server,
4. images: dimension checks, auto-rotation, EXIF stripped, **WebP renditions** — `thumb` (640w) and `medium` (1800w) — plus a tiny blur placeholder; **the original is preserved**,
5. videos: duration check (≤10 min) and a poster frame via ffprobe/ffmpeg,
6. objects stored through the `StorageProvider`; Postgres stores only keys + metadata.

Key layout (identical locally and in S3):

```text
wedding/gallery/<album>/<id>/{original.jpg, thumb.webp, medium.webp}
wedding/live/<id>/…
wedding/guestbook/<id>/…
wedding/branding/ · wedding/dresscode/ · wedding/story/
private/backups/…            ← never served publicly
```

Guests only ever load the `thumb`/`medium` WebP renditions via `srcset` with lazy loading — never the 10 MB originals.

**S3 mode:** the bucket stays **private**; the backend signs short-lived GET URLs (6 h by default, cached). AWS credentials never leave the server — use an EC2 instance role.

---

## 7. Realtime (SSE)

`GET /api/live/stream` is a Server-Sent Events stream. When an admin publishes (or a scheduled post goes live), the backend saves to Postgres and broadcasts:

```json
{ "id": 1790272345123, "type": "LIVE_UPDATE_CREATED", "eventId": "…", "postId": "…", "timestamp": "2026-12-03T15:48:00.000Z" }
```

Other types: `LIVE_UPDATE_UPDATED`, `LIVE_UPDATE_DELETED`, `SCHEDULE_CHANGED`, `MEDIA_PUBLISHED`, `SETTINGS_CHANGED`.

The browser (`frontend/src/hooks/useLiveStream.ts`) fetches the post and renders it immediately. Resilience:

- heartbeats every 25 s + a client watchdog that reconnects silently dead connections;
- exponential-backoff reconnects; **`Last-Event-ID` replay** of missed messages; resync after server restarts;
- de-duplication by message id;
- refresh when the tab becomes visible again or the phone comes back online;
- **automatic fallback to polling** if SSE is unavailable or keeps failing (and periodic attempts to upgrade back).

nginx is configured with `proxy_buffering off` for the stream.

---

## 8. Testing

```bash
docker compose up -d db          # tests use the wedding_test database on localhost:55432
npm install
npm test                         # shared + backend + frontend
```

Or inside the container: `docker compose exec backend npm test -w backend`.

| Suite | Covers |
|---|---|
| `shared` | schedule engine (every phase boundary with the real dates), countdown, timezone conversion, ICS/Google/Outlook |
| `backend` | authentication, admin authorisation & CSRF, audit log, RSVP creation/validation/duplicates/idempotency, guest side, **room allotment** (multi-venue, shared-room warnings, cascade), event-manager contacts (public vs private), RSVP admin + **real .xlsx export** (sheets, frozen headers, filters, totals), events API & schedule, ICS, gallery uploads (renditions, spoofed executables, size limits), guestbook moderation, live updates (publish/draft/schedule/broadcasts), local + S3 storage providers, config safety |
| `backend` integration | **admin creates live post → DB row → SSE event → guest receives it → guest fetches the post**, plus Last-Event-ID replay — over real HTTP |
| `frontend` | countdown, event timeline, What's Happening Now (pre/live/between/archive), RSVP form (validation, submission, decline, errors), live feed rendering, **SSE event → UI update without refresh**, duplicate suppression, polling fallback |

---

## 9. Deploying to AWS — step by step

This guide assumes no prior AWS experience. Budget: a `t3.small` instance (~US$15–20/month) + S3 (cents) + a domain.

### 9.1 Create an AWS account & choose a region

Sign up at https://aws.amazon.com. In the top-right region selector choose **Asia Pacific (Mumbai) `ap-south-1`** — closest to your guests. Use this region for everything below.

### 9.2 Create the S3 bucket (photos & videos)

1. Open **S3 → Create bucket**.
2. Name: something unique, e.g. `rishabh-nandita-wedding-media`.
3. **Block all public access: ON** (keep the default). The site uses presigned URLs.
4. **Bucket versioning: Enable** (protects against accidental deletes/overwrites).
5. Default encryption: **SSE-S3**. Create.
6. *(Recommended)* Create a second bucket for database backups, e.g. `rishabh-nandita-wedding-backups`, same settings.

### 9.3 Create an IAM role for the server (least privilege)

1. **IAM → Policies → Create policy → JSON**, paste (replace bucket names):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "WeddingMedia",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::rishabh-nandita-wedding-media/*"
    },
    {
      "Sid": "WeddingMediaList",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::rishabh-nandita-wedding-media"
    },
    {
      "Sid": "WeddingBackups",
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::rishabh-nandita-wedding-backups/*"
    }
  ]
}
```

   Name it `wedding-app-s3`.
2. **IAM → Roles → Create role** → trusted entity **AWS service → EC2** → attach `wedding-app-s3` → name `wedding-app-role`.

No access keys are created, so there is nothing to leak. (The backup bucket only allows *put* — a compromised server cannot delete old backups.)

### 9.4 Launch the EC2 instance

1. **EC2 → Launch instance**.
2. Name `wedding`. AMI: **Ubuntu Server 24.04 LTS**. Type: **t3.small** (2 GB RAM).
3. Key pair: create one (download the `.pem` — you need it to SSH in).
4. Network settings → **Create security group** allowing: SSH (22) **from My IP only**, HTTP (80) and HTTPS (443) from anywhere.
5. Storage: **30 GB gp3**.
6. Advanced details → **IAM instance profile: `wedding-app-role`**.
7. Launch. Then **EC2 → Elastic IPs → Allocate** and **associate** it with the instance so the IP never changes.

### 9.5 Point your domain at the server

In your DNS provider (Route 53, GoDaddy, Namecheap, Cloudflare…):

| Type | Name | Value |
|---|---|---|
| A | `@` | your Elastic IP |
| A | `www` | your Elastic IP |

(With Cloudflare, set the records to **DNS only** — grey cloud — at least until the certificate is issued.) Check with `nslookup yourdomain.com`.

### 9.6 Install Docker on the server

```bash
ssh -i wedding.pem ubuntu@<ELASTIC_IP>
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && exit        # log out and back in for the group to apply
ssh -i wedding.pem ubuntu@<ELASTIC_IP>
docker compose version                        # should print v2.x
sudo apt-get install -y awscli                # optional: for nightly backups to S3
# Recommended on 2 GB instances: add 2 GB swap for image builds
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 9.7 Get the code and configure `.env`

```bash
git clone <repository> wedding-platform && cd wedding-platform
cp .env.example .env
openssl rand -hex 48                                  # → JWT_SECRET
openssl rand -base64 32 | tr -d '/+='                 # → POSTGRES_PASSWORD
nano .env
```

Fill in at least: `DOMAIN`, `PUBLIC_URL`, `POSTGRES_PASSWORD` **and the same password inside `DATABASE_URL`**, `JWT_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION=ap-south-1`. Then `chmod 600 .env`.

### 9.8 PostgreSQL

The default is **PostgreSQL in Docker** (`db` service, data on the `pgdata` volume) — simple and cheap, backed up by `docker/backup.sh` + EBS snapshots.

*Alternative — Amazon RDS:* create an RDS PostgreSQL 16 `db.t4g.micro` in the same VPC, allow port 5432 from the EC2 security group only, set `DATABASE_URL=postgresql://user:pass@<rds-endpoint>:5432/wedding?schema=public&sslmode=require`, and remove the `db` service and the `depends_on: db` block from `docker-compose.prod.yml`.

### 9.9 Start the stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps          # all services "healthy" after ~1 min
docker compose -f docker-compose.prod.yml logs -f app # migrations → seed → "listening"
```

nginx starts with a temporary self-signed certificate so the next step can run.

### 9.10 Enable HTTPS (Let's Encrypt)

```bash
sh docker/init-letsencrypt.sh
```

This requests a real certificate for `DOMAIN` (and `www.` unless `INCLUDE_WWW=false`) and reloads nginx. `LETSENCRYPT_EMAIL` is optional: without it the script registers with `--register-unsafely-without-email`. The only difference is that you won't get expiry-warning emails, which you don't need because renewal is automatic. Renewal is automatic: the `certbot` container renews every 12 h and nginx reloads every 6 h. (Testing? set `LETSENCRYPT_STAGING=true` first to avoid rate limits.)

Visit `https://yourdomain.com` and `https://yourdomain.com/admin`. Log in with your `SEED_ADMIN_*` credentials, then:

1. **Settings** — check names, contacts (replace the placeholder phone numbers), hashtag; upload a monogram and social image if you like.
2. **Venues** — add full addresses, parking and landmarks.
3. **Events / Dress code / Story / Travel / FAQ** — review the seeded content.
4. Share the link on WhatsApp — the preview uses the title, description and image from Settings. (WhatsApp caches previews; test with a fresh link or `?v=1`.)

### 9.11 Updating the application

```bash
cd ~/wedding-platform
sh docker/backup.sh                                   # safety first
git pull
docker compose -f docker-compose.prod.yml up -d --build   # migrations apply automatically on start
docker image prune -f
```

### 9.12 Viewing logs

```bash
docker compose -f docker-compose.prod.yml logs -f app      # API (JSON logs)
docker compose -f docker-compose.prod.yml logs -f nginx    # access/errors
docker compose -f docker-compose.prod.yml logs --since 1h app | grep '"level":50'   # errors only
```

Logs rotate automatically (10 MB × 5 files per container). Admin actions are also recorded in the `AuditLog` table.

---

## 10. Backups & restore

**Do not rely on S3 alone.** The strategy has three layers:

| What | How | Where |
|---|---|---|
| Database — on demand | Admin → **Backups → Backup database** (pg_dump, gzipped) | `private/backups/` in storage (S3 in prod), downloadable from the admin |
| Database — nightly | `docker/backup.sh` from cron | `./backups/` on the server + `BACKUP_S3_URI` |
| Server disk | EBS snapshots via **EC2 → Lifecycle Manager**: daily, keep 14 | AWS |
| Photos & videos | S3 **versioning** (enabled above) + *optional* **Cross-Region Replication** to a bucket in another region, or **AWS Backup** for S3 | AWS |

Set up the nightly job:

```bash
crontab -e
0 3 * * * /home/ubuntu/wedding-platform/docker/backup.sh >> /home/ubuntu/wedding-backup.log 2>&1
```

Recommended extra step for the wedding week: take a manual backup and an EBS snapshot on 2 December and again on 5 December.

### Restoring

- **Database** (from `backups/` or a file downloaded from the admin):
  ```bash
  sh docker/restore.sh backups/wedding-db-2026-12-05T03-00-00Z.sql.gz
  ```
  From S3 first: `aws s3 cp s3://…/wedding-db-….sql.gz backups/`.
- **A deleted photo:** S3 console → bucket → *Show versions* → restore the previous version.
- **Whole server lost:** launch a new instance from the latest EBS snapshot (or repeat §9 on a fresh instance), restore the latest database dump, re-point the Elastic IP. Media is safe in S3.

---

## 11. Operating the site (updates, logs, previewing phases)

**Live updates during the wedding** — Admin → *Live Updates*: write a caption, optionally add a photo/video (uploads from a phone work), pick the celebration and **Publish now** — every guest with the site open sees it within a second. You can also **Schedule** posts (e.g. "Lunch is served" at 1:30 PM) or keep **drafts**.

**Live mode** is automatic (on event days). Settings → *Live mode* can force it **On** or **Off**, and edit the banner text.

**Simulator (development only)** — on the guest site in development, a dark **⏱ Simulator** button sits bottom-left. It jumps the site's clock to any moment of the wedding so you can see exactly what guests will see:

- *Before*: a week before / an hour before the first celebration
- *Live mode*: during each celebration (one preset per event, taken from the database)
- *Between*: the gaps on event days (e.g. between Haldi/Mehendi and the Sangeet)
- *Post-wedding*: the morning after (wedding archive) and a year later
- or any custom date and time

A striped banner shows the simulated time and phase; "Back to real time" resets it. Only your browser's clock changes. Data, other visitors and the server are untouched, and posts dated after the simulated time are hidden so the feed looks as it would at that moment. The simulator is compiled out of production builds entirely.

**WhatsApp group QR** — Admin → Settings → *WhatsApp group*: paste the group invite link (WhatsApp → group → *Invite via link* → *Copy link*). A QR code is generated automatically (live preview + *Download QR (PNG)* for printing) and shown to guests on the home page and in *Need a hand? → Need help?*. Change the link and the QR updates everywhere; clear it to hide the section.

**Previewing a phase via URL (development only)** — add `?now=` to any URL (ignored in production builds):

- `http://localhost:3000/?now=2026-12-03T21:20:00%2B05:30` → Sangeet is **LIVE**
- `http://localhost:3000/?now=2026-12-03T16:00:00%2B05:30` → between Haldi and Sangeet
- `http://localhost:3000/?now=2026-12-06T10:00:00%2B05:30` → **Wedding Archive**
- `http://localhost:3000/?now=reset` → back to real time

The API accepts the same parameter on `/api/schedule?now=…` outside production.

**RSVPs & guest sides** — guests choose *Bride's side* or *Groom's side* when they RSVP. Admin → *RSVPs & Rooms* shows the split, and both the guest list and the Rooms board can be filtered by side.

**Room allotment** — Admin → *RSVPs & Rooms* → **Rooms** tab:

1. *Add room venue* for each hotel / guest house / club block (name, address, maps link, contact).
2. Use **All guests / Bride's side / Groom's side** to allot one family's rooms at a time. Parties that are attending but have no room appear under **Waiting for a room** — click one, pick the venue, enter the room number and check-in/check-out.
3. A party can hold several rooms, even across venues. Allotting a room that is already taken is allowed (families share) but you are warned who else is in it.
4. In the **Guests** tab, the *Rooms* column / button does the same per RSVP, and the filter "Needs a room" / "Staying at …" narrows the list.

Editors (not only admins) can manage rooms, so the hospitality team can have their own EDITOR logins.

**Event manager contacts** — Admin → *Contacts*: name, role, phone, WhatsApp, email, optional celebration. Public contacts appear to guests in *Need a hand? → Need help?* and on the celebration's page (event-specific managers first); private ones (e.g. vendors) are for the team only.

**RSVP Excel** — Admin → RSVPs → *Download RSVP Excel*: sheets *All RSVPs, Summary, Engagement, Haldi & Mehendi, Sangeet, Wedding, Rooms* (the final day's ceremonies grouped; Rooms lists every allotted room by hotel), with side and room columns, filters, frozen headers, readable IST dates and guest totals. The Summary sheet includes the bride's/groom's side split and rooms still needed. (Excel does not allow `/` in sheet names, hence "Haldi & Mehendi".)

---

## 12. Troubleshooting

| Symptom | Fix |
|---|---|
| `docker compose up` fails on port 3000/4000/55432 | Another app uses the port — stop it or change the left side of the port mapping in `docker-compose.yml`. |
| Backend keeps restarting in dev | `docker compose logs backend`. If the DB volume is from an older schema: `docker compose down -v`. |
| Code changes to the backend aren't picked up on Windows/macOS | File-watch events don't always cross Docker bind mounts: `docker compose restart backend`. (The frontend uses polling and reloads automatically.) |
| Production: `Refusing to start in production` | The message lists the missing/insecure variables in `.env`. |
| Production seed: `Set SEED_ADMIN_PASSWORD…` | Set a strong `SEED_ADMIN_PASSWORD` (the dev default is refused). |
| Certificate request fails | DNS must point to the Elastic IP, ports 80/443 open in the security group, Cloudflare proxy off. Retry with `LETSENCRYPT_STAGING=true` to debug. |
| Photos don't load in production | Check `S3_BUCKET`/`S3_REGION`, that the instance role is attached, and `docker compose … logs app` for `AccessDenied`. |
| Live updates arrive late | Behind another proxy/CDN? It must not buffer `/api/live/stream`. The site falls back to polling every 20 s either way. |
| WhatsApp shows an old preview | WhatsApp caches per URL — share `https://yourdomain.com/?v=2`. |
| Forgot the admin password | Reset it from the server (replace the email and password): see the command below this table. |

Reset an admin password:

```bash
docker compose -f docker-compose.prod.yml exec -e NEW_PASSWORD='a-new-long-password' -e ADMIN_EMAIL='admin@example.com' app \
  node -e "const b=require('bcryptjs');const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();b.hash(process.env.NEW_PASSWORD,12).then(h=>p.user.update({where:{email:process.env.ADMIN_EMAIL},data:{passwordHash:h}})).then(()=>console.log('Password reset')).finally(()=>p.\$disconnect())"
```

---

## 13. Production security checklist

- [ ] `JWT_SECRET` is a fresh 64+ character random value
- [ ] `SEED_ADMIN_PASSWORD` is strong and unique; changed again from **Settings → Change password** after first login
- [ ] Placeholder phone numbers / emails replaced in Settings and Travel
- [ ] `.env` is `chmod 600` and never committed
- [ ] `STORAGE_DRIVER=s3`, bucket has **Block Public Access ON**, versioning ON, encryption ON
- [ ] EC2 uses an **instance role** (no AWS keys in `.env`); IAM policy limited to the wedding buckets
- [ ] Security group: SSH restricted to your IP; only 80/443 public
- [ ] HTTPS certificate issued (`https://` works, `http://` redirects)
- [ ] Nightly `backup.sh` cron installed and one restore tested
- [ ] EBS snapshot lifecycle policy enabled
- [ ] `sudo apt-get upgrade` / unattended-upgrades enabled on the host
- [ ] Logged in once from a phone over mobile data to test the full guest journey

Built-in protections: bcrypt (cost 12) password hashing · HttpOnly/Secure/SameSite=Strict session cookie · CSRF tokens on every admin mutation · role-based authorisation (ADMIN / EDITOR) · zod validation on every input · Prisma parameterised queries · React output escaping + strict CSP · helmet security headers + HSTS · CORS allow-list · rate limiting (API, login, RSVP, guestbook, uploads) · magic-byte upload validation, size/dimension/duration limits, no executables/SVG/HTML · private S3 with presigned URLs · audit log of admin actions · friendly errors without stack traces in production.
