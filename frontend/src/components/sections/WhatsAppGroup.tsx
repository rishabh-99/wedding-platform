import { useEffect, useState } from 'react';
import { FramedCorners } from '../ornaments/Ornaments';

/**
 * Generates a QR code (PNG data URL) for a link, in the browser, with the
 * `qrcode` library (loaded on demand so it never weighs down the first page load).
 * Regenerates whenever the link changes — nothing is stored on the server.
 */
export function useQrCode(value: string | null | undefined, size = 480): { dataUrl: string | null; error: boolean } {
  const [state, setState] = useState<{ dataUrl: string | null; error: boolean }>({ dataUrl: null, error: false });
  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setState({ dataUrl: null, error: false });
      return;
    }
    import('qrcode')
      .then((QRCode) =>
        QRCode.toDataURL(value, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: size,
          color: { dark: '#4E1420', light: '#FFFDF7' },
        }),
      )
      .then((dataUrl) => !cancelled && setState({ dataUrl, error: false }))
      .catch(() => !cancelled && setState({ dataUrl: null, error: true }));
    return () => {
      cancelled = true;
    };
  }, [value, size]);
  return state;
}

export function WhatsAppIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}

/** "Join the wedding WhatsApp group": one tap on phones, scan the QR on a computer. */
export function WhatsAppGroupCard({ url, compact = false }: { url: string | null | undefined; compact?: boolean }) {
  const { dataUrl } = useQrCode(url);
  if (!url) return null;
  return (
    <div className={`card-paper relative mx-auto flex max-w-2xl flex-col items-center gap-6 text-center sm:flex-row sm:text-left ${compact ? 'px-5 py-6' : 'px-6 py-8 sm:px-10'}`}>
      {!compact && <FramedCorners size="h-7 w-7" />}
      <div className="shrink-0">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt="QR code to join the wedding WhatsApp group"
            width={compact ? 132 : 168}
            height={compact ? 132 : 168}
            className="border border-gold/40 bg-[#FFFDF7] p-1"
          />
        ) : (
          <div className={`skeleton ${compact ? 'h-[132px] w-[132px]' : 'h-[168px] w-[168px]'}`} aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0">
        <p className="label-sm">Stay in the loop</p>
        <p className={`mt-1 font-display text-maroon ${compact ? 'text-2xl' : 'text-3xl'}`}>Join our WhatsApp group</p>
        <p className="body-copy mt-2">
          Updates, reminders and photos from the celebrations. Scan the code with your phone’s camera, or tap the button.
        </p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4 w-full sm:w-auto">
          <WhatsAppIcon className="h-4 w-4" />
          Join the group
        </a>
      </div>
    </div>
  );
}
