import { useEffect, useRef, useState } from 'react';
import { btn, Modal } from './ui';

/**
 * Camera QR scanner for guest passes (uses `qr-scanner`, loaded only when opened).
 * Calls `onScan` once per distinct code; the parent decides whether to close.
 */
export function QrScannerModal({ open, onClose, onScan, title = 'Scan guest pass' }: { open: boolean; onClose: () => void; onScan: (value: string) => void; title?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!open) return;
    let scanner: { stop: () => void; destroy: () => void } | null = null;
    let cancelled = false;
    let last = '';
    let lastAt = 0;
    setError(null);
    void import('qr-scanner')
      .then(async ({ default: QrScanner }) => {
        if (cancelled || !videoRef.current) return;
        if (!(await QrScanner.hasCamera())) {
          setError('No camera found on this device. Use search and tick guests manually instead.');
          return;
        }
        const s = new QrScanner(
          videoRef.current,
          (result) => {
            const now = Date.now();
            // Ignore the same code held in front of the camera.
            if (result.data === last && now - lastAt < 4000) return;
            last = result.data;
            lastAt = now;
            navigator.vibrate?.(60);
            onScanRef.current(result.data);
          },
          { preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 8 },
        );
        scanner = s;
        await s.start();
      })
      .catch(() => {
        if (!cancelled)
          setError(
            window.isSecureContext
              ? 'Camera permission was denied. Allow camera access for this site, or tick guests manually.'
              : 'The camera only works over HTTPS. Use the phone’s camera app on the guest’s QR, or tick guests manually.',
          );
      });
    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
    };
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="relative overflow-hidden rounded-sm bg-ink">
        <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-maroon">
          {error}
        </p>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">Point the camera at the family’s guest pass.</p>
      )}
      <div className="mt-4 flex justify-end">
        <button type="button" className={btn.secondary} onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
