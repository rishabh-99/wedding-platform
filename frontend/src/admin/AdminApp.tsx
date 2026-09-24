import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { SessionUser } from '@wedding/shared';
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

const NAV = [
  { to: '', label: 'Dashboard' },
  { to: 'events', label: 'Events' },
  { to: 'venues', label: 'Venues' },
  { to: 'live', label: 'Live Updates' },
  { to: 'gallery', label: 'Gallery' },
  { to: 'rsvps', label: 'RSVPs & Rooms', adminOnly: true },
  { to: 'guestbook', label: 'Guestbook' },
  { to: 'story', label: 'Wedding Story' },
  { to: 'dress-code', label: 'Dress Code' },
  { to: 'travel', label: 'Travel & Stay' },
  { to: 'faq', label: 'FAQ' },
  { to: 'contacts', label: 'Contacts' },
  { to: 'settings', label: 'Settings' },
  { to: 'media', label: 'Media Library' },
  { to: 'backups', label: 'Backups', adminOnly: true },
];

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

  const items = NAV.filter((n) => !n.adminOnly || user.role === 'ADMIN');

  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[15rem_1fr]">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform overflow-y-auto border-r border-gold/30 bg-ivory transition-transform lg:static lg:w-auto lg:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="border-b border-gold/25 px-5 py-5">
          <p className="font-label text-[0.62rem] uppercase tracking-label text-gold-deep">Wedding</p>
          <p className="font-display text-2xl text-maroon">Admin</p>
        </div>
        <nav aria-label="Admin" className="px-2 py-3">
          <ul>
            {items.map((item) => (
              <li key={item.to}>
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
          {user.email} · {user.role.toLowerCase()}
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
              <Route index element={<Dashboard />} />
              <Route path="events" element={<Events />} />
              <Route path="venues" element={<Venues />} />
              <Route path="live" element={<Live />} />
              <Route path="gallery" element={<Gallery />} />
              <Route path="rsvps" element={<Rsvps />} />
              <Route path="guestbook" element={<Guestbook />} />
              <Route path="story" element={<Story />} />
              <Route path="dress-code" element={<DressCode />} />
              <Route path="travel" element={<Travel />} />
              <Route path="faq" element={<Faq />} />
              <Route path="settings" element={<Settings user={user} />} />
              <Route path="media" element={<MediaLibrary />} />
              <Route path="backups" element={<Backups />} />
              <Route path="contacts" element={<Contacts />} />
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
      navigate(from && from.startsWith('/admin') && from !== '/admin/login' ? from : '/admin', { replace: true });
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
        <h1 className="font-display text-3xl text-maroon">Admin sign in</h1>
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
            Development account: <code>admin@wedding.local</code> / <code>ChangeMe!2026</code>. Change it before going live.
          </p>
        )}
      </form>
    </div>
  );
}
