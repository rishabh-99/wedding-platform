import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClockContext, useClockState } from './hooks/useClock';
import { GuestLayout } from './layouts/GuestLayout';
import { ErrorBoundary, LoadingBlock } from './components/ui/primitives';
import { ApiError } from './services/api';

// Guest pages are split so the first load only ships the home page.
const HomePage = lazy(() => import('./pages/HomePage'));
const EventPage = lazy(() => import('./pages/EventPage'));
const GalleryPage = lazy(() => import('./pages/GalleryPage'));
const pages = () => import('./pages/ContentPages');
const NowPage = lazy(() => pages().then((m) => ({ default: m.NowPage })));
const CelebrationsPage = lazy(() => pages().then((m) => ({ default: m.CelebrationsPage })));
const ItineraryPage = lazy(() => pages().then((m) => ({ default: m.ItineraryPage })));
const JournalPage = lazy(() => pages().then((m) => ({ default: m.JournalPage })));
const RsvpPage = lazy(() => pages().then((m) => ({ default: m.RsvpPage })));
const BlessingsPage = lazy(() => pages().then((m) => ({ default: m.BlessingsPage })));
const StoryPage = lazy(() => pages().then((m) => ({ default: m.StoryPage })));
const VenuesPage = lazy(() => pages().then((m) => ({ default: m.VenuesPage })));
const TravelPage = lazy(() => pages().then((m) => ({ default: m.TravelPage })));
const DressCodePage = lazy(() => pages().then((m) => ({ default: m.DressCodePage })));
const FaqPage = lazy(() => pages().then((m) => ({ default: m.FaqPage })));
const PassPage = lazy(() => import('./pages/PassPage'));
const QrLandingPage = lazy(() => import('./pages/QrLandingPage'));
const NotFoundPage = lazy(() => pages().then((m) => ({ default: m.NotFoundPage })));

// The admin portal is a separate bundle — never downloaded by guests.
const AdminApp = lazy(() => import('./admin/AdminApp'));

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
        refetchOnWindowFocus: false,
      },
    },
  });
}

const queryClient = createQueryClient();

export function ClockProvider({ children }: { children: ReactNode }) {
  const clock = useClockState();
  return <ClockContext.Provider value={clock}>{children}</ClockContext.Provider>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <ClockProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <Routes>
                <Route
                  path="/admin/*"
                  element={
                    <Suspense fallback={<div className="p-10"><LoadingBlock lines={4} label="Loading admin" /></div>}>
                      <AdminApp />
                    </Suspense>
                  }
                />
                <Route element={<GuestLayout />}>
                  <Route index element={<HomePage />} />
                  <Route path="now" element={<NowPage />} />
                  <Route path="celebrations" element={<CelebrationsPage />} />
                  <Route path="celebrations/:slug" element={<EventPage />} />
                  <Route path="itinerary" element={<ItineraryPage />} />
                  <Route path="journal" element={<JournalPage />} />
                  <Route path="gallery" element={<GalleryPage />} />
                  <Route path="venues" element={<VenuesPage />} />
                  <Route path="rsvp" element={<RsvpPage />} />
                  <Route path="blessings" element={<BlessingsPage />} />
                  <Route path="story" element={<StoryPage />} />
                  <Route path="travel" element={<TravelPage />} />
                  <Route path="dress-code" element={<DressCodePage />} />
                  <Route path="faq" element={<FaqPage />} />
                  <Route path="pass" element={<PassPage />} />
                  <Route path="q/:token" element={<QrLandingPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </ErrorBoundary>
          </BrowserRouter>
        </ClockProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
