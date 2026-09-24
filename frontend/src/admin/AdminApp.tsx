import { lazy, Suspense, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { can, ROLE_LABELS, type Permission, type Role, type SessionUser } from '@wedding/shared';
import { ApiError, api, setCsrfToken } from '../services/api';
import { LoadingBlock } from '../components/ui/primitives';
import { adminKeys, useMe } from './adminApi';
import { ToastProvider } from './components/Toast';
import { btn, FieldRow, TextInput } from './components/ui';

const Dashboard = lazy(() => import('./pages/DashboardPage'));
const Events = lazy(() => import('./pages/EventsPage'));
const Venues = lazy(() => import('./pages/VenuesPage'));
const Live = lazy(() => import('./pages/LivePage'));
const Gallery = lazy(() => import('./pages/GalleryAdminPage'));
const Rsvps = lazy(() => import('./pages/RsvpsPage'));
const Guestbook = lazy(() => import('./pages/GuestbookPage'));
const content = () => import('./pages/ContentAdminPages');
const Story = lazy(() => content().then((m) => ({ default: m.StoryAdminPage })));
const Travel = lazy(() => content().then((m) => ({ default: m.TravelAdminPage })));
const Faq = lazy(() => content().then((m) => ({ default: m.FaqAdminPage })));
const DressCode = lazy(() => import('./pages/DressCodePage'));
const Settings = lazy(() => import('./pages/SettingsPage'));
const MediaLibrary = lazy(() => import('./pages/MediaLibraryPage'));
const Backups = lazy(() => import('./pages/BackupsPage'));
const Contacts = lazy(() => import('./pages/ContactsPage'));
const Team = lazy(() => import('./pages/TeamPage'));
const CheckIn = lazy(() => import('./pages/CheckInPage'));
const Portraits = lazy(() => import('./pages/PortraitsPage'));
const Arrivals = lazy(() => import('./pages/ArrivalsPage'));

/** Sidebar items; each role only sees what it is allowed to use (enforced again by the API). */
const NAV: { to: string; label: string; perm: Permission; group?: string }[] = [
  { to: '', label: 'Dashboard', perm: 'content' },
  { to: 'checkin', label: 'Check-in', perm: 'checkin', group: 'On the day' },
  { to: 'portraits', label: 'Photo of the day', perm: 'portraits', group: 'On the day' },
  { to: 'arrivals', label: 'Arrivals & pickups', perm: 'arrivals', group: 'On the day' },
  { to: 'live', label: 'Live Updates', perm: 'live', group: 'On the day' },
  { to: 'rsvps', label: 'RSVPs & Rooms', perm: 'guests', group: 'Guests' },
  { to: 'guestbook', label: 'Guestbook', perm: 'guestbook', group: 'Guests' },
  { to: 'contacts', label: 'Contacts', perm: 'contacts', group: 'Guests' },
  { to: 'events', label: 'Events', perm: 'events', group: 'Website' },
  { to: 'venues', label: 'Venues', perm: 'events', group: 'Website' },
  { to: 'gallery', label: 'Gallery', perm: 'gallery', group: 'Website' },
  { to: 'story', label: 'Wedding Story', perm: 'content', group: 'Website' },
  { to: 'dress-code', label: 'Dress Code', perm: 'events', group: 'Website' },
  { to: 'travel', label: 'Travel & Stay', perm: 'content', group: 'Website' },
  { to: 'faq', label: 'FAQ', perm: 'content', group: 'Website' },
  { to: 'media', label: 'Media Library', perm: 'gallery', group: 'Website' },
  { to: 'team', label: 'Team', perm: 'team', group: 'Admin' },
  { to: 'settings', label: 'Settings', perm: 'settings', group: 'Admin' },
  { to: 'backups', label: 'Backups', perm: 'backups', group: 'Admin' },
];

/** Where each role lands after signing in ('' = dashboard). */
function homeFor(role: Role): string {
  if (can(role, 'content')) return '';
  if (can(role, 'portraits')) return 'portraits';
  if (can(role, 'arrivals')) return 'arrivals';
  if (can(role, 'checkin')) return 'checkin';
  return NAV.find((n) => can(role, n.perm))?.to ?? '';
}

function Guard({ user, perm, children }: { user: SessionUser; perm: Permission; children: ReactNode }) {
  return can(user.role, perm) ? <>{children}</> : <Navigate to="/admin" replace />;
}

export default function AdminApp() {
  useEffect(() => {
    document.title = 'Wedding Admin';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-ivory-100/60">
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route path="*" element={<Protected />} />
        </Routes>
      </div>
    </ToastProvider>
  );
}

function Protected() {
  const me = useMe();
  const location = useLocation();

  useEffect(() => {
    if (me.data?.csrfToken) setCsrfToken(me.data.csrfToken);
  }, [me.data?.csrfToken]);

  if (me.isLoading) {
    return (
      <div className="mx-auto max-w-md p-10">
        <LoadingBlock lines={3} label="Checking your session" />
      </div>
    );
  }
  if (me.isError || !me.data) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  return <AdminLayout user={me.data.user} />;
}

function AdminLayout({ user }: { user: SessionUser }) {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => setNavOpen(false), [location.pathname]);

  const logout = async () => {
    try {
      await api.post('/api/admin/auth/logout');
    } finally {
      setCsrfToken(null);
      qc.removeQueries({ queryKey: ['admin'] });
      navigate('/admin/login', { replace: true });
    }
  };

  const items = NAV.filter((n) => can(user.role, n.perm));
  const home = homeFor(user.role);

  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[15rem_1fr]">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform overflow-y-auto border-r border-gold/30 bg-ivory transition-transform lg:static lg:w-auto lg:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="border-b border-gold/25 px-5 py-5">
          <p className="font-label text-[0.62rem] uppercase tracking-label text-gold-deep">Wedding</p>
          <p className="font-display text-2xl text-maroon">{user.role === 'ADMIN' ? 'Admin' : ROLE_LABELS[user.role]}</p>
        </div>
        <nav aria-label="Admin" className="px-2 py-3">
          <ul>
            {items.map((item, i) => (
              <li key={item.to}>
                {item.group && item.group !== items[i - 1]?.group && (
                  <p className="mt-3 px-3 pb-1 text-[0.62rem] font-semibold uppercase tracking-wider text-gold-deep">{item.group}</p>
                )}
                <NavLink
                  to={`/admin${item.to ? `/${item.to}` : ''}`}
                  end={item.to === ''}
                  className={({ isActive }) =>
                    `flex min-h-[40px] items-center rounded-sm px-3 text-sm ${isActive ? 'bg-maroon text-ivory' : 'text-ink-soft hover:bg-gold/10 hover:text-maroon'}`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
            <li className="mt-3 border-t border-gold/20 pt-3">
              <a href="/" target="_blank" rel="noreferrer" className="flex min-h-[40px] items-center rounded-sm px-3 text-sm text-ink-soft hover:bg-gold/10">
                View website ↗
              </a>
            </li>
            <li>
              <button type="button" onClick={logout} className="flex min-h-[40px] w-full items-center rounded-sm px-3 text-left text-sm text-ink-soft hover:bg-gold/10 hover:text-maroon">
                Logout
              </button>
            </li>
          </ul>
        </nav>
        <p className="px-5 pb-5 text-xs text-ink-muted">
          Signed in as {user.name}
          <br />
          {user.email} · {ROLE_LABELS[user.role]}
        </p>
      </aside>
      {navOpen && <button type="button" aria-label="Close menu" className="fixed inset-0 z-30 bg-ink/30 lg:hidden" onClick={() => setNavOpen(false)} />}

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gold/25 bg-ivory/95 px-4 py-3 backdrop-blur lg:hidden">
          <button type="button" className={btn.ghost} onClick={() => setNavOpen(true)} aria-label="Open admin menu">
            ☰ Menu
          </button>
          <span className="font-display text-xl text-maroon">Wedding Admin</span>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
          <Suspense fallback={<LoadingBlock lines={5} />}>
            <Routes>
              <Route index element={home ? <Navigate to={`/admin/${home}`} replace /> : <Dashboard />} />
              <Route path="checkin" element={<Guard user={user} perm="checkin"><CheckIn /></Guard>} />
              <Route path="portraits" element={<Guard user={user} perm="portraits"><Portraits /></Guard>} />
              <Route path="arrivals" element={<Guard user={user} perm="arrivals"><Arrivals /></Guard>} />
              <Route path="events" element={<Guard user={user} perm="events"><Events /></Guard>} />
              <Route path="venues" element={<Guard user={user} perm="events"><Venues /></Guard>} />
              <Route path="live" element={<Guard user={user} perm="live"><Live /></Guard>} />
              <Route path="gallery" element={<Guard user={user} perm="gallery"><Gallery /></Guard>} />
              <Route path="rsvps" element={<Guard user={user} perm="guests"><Rsvps user={user} /></Guard>} />
              <Route path="guestbook" element={<Guard user={user} perm="guestbook"><Guestbook /></Guard>} />
              <Route path="story" element={<Guard user={user} perm="content"><Story /></Guard>} />
              <Route path="dress-code" element={<Guard user={user} perm="events"><DressCode /></Guard>} />
              <Route path="travel" element={<Guard user={user} perm="content"><Travel /></Guard>} />
              <Route path="faq" element={<Guard user={user} perm="content"><Faq /></Guard>} />
              <Route path="settings" element={<Guard user={user} perm="settings"><Settings user={user} /></Guard>} />
              <Route path="media" element={<Guard user={user} perm="gallery"><MediaLibrary /></Guard>} />
              <Route path="backups" element={<Guard user={user} perm="backups"><Backups /></Guard>} />
              <Route path="contacts" element={<Guard user={user} perm="contacts"><Contacts /></Guard>} />
              <Route path="team" element={<Guard user={user} perm="team"><Team user={user} /></Guard>} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ user: SessionUser; csrfToken: string }>('/api/admin/auth/login', { email, password });
      setCsrfToken(res.csrfToken);
      qc.setQueryData(adminKeys.me, res);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && (from.startsWith('/q/') || (from.startsWith('/admin') && from !== '/admin/login')) ? from : '/admin', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm border border-gold/40 bg-ivory px-6 py-8 shadow-paper" noValidate>
        <p className="font-label text-[0.62rem] uppercase tracking-label text-gold-deep">Wedding</p>
        <h1 className="font-display text-3xl text-maroon">Team sign in</h1>
        <div className="mt-6 space-y-4">
          <FieldRow label="Email" htmlFor="email">
            <TextInput id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </FieldRow>
          <FieldRow label="Password" htmlFor="password">
            <TextInput id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </FieldRow>
        </div>
        {error && (
          <p role="alert" className="mt-4 text-sm text-maroon">
            {error}
          </p>
        )}
        <button type="submit" className={`${btn.primary} mt-6 w-full`} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {import.meta.env.DEV && (
          <p className="mt-5 border-t border-gold/20 pt-4 text-xs text-ink-muted">
            Development accounts (password <code>ChangeMe!2026</code>): <code>admin@</code>, <code>coordinator@</code>, <code>hospitality@</code>, <code>photographer@</code> and <code>editor@wedding.local</code>. Change them before going live.
          </p>
        )}
      </form>
    </div>
  );
}
