import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type Kind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  message: string;
  kind: Kind;
}

const ToastContext = createContext<{ show: (message: string, kind?: Kind) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((message: string, kind: Kind = 'info') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-3), { id, message, kind }]);
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[min(92vw,22rem)] flex-col gap-2">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              role={t.kind === 'error' ? 'alert' : 'status'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`pointer-events-auto border px-4 py-3 text-sm shadow-paper ${
                t.kind === 'error'
                  ? 'border-maroon/40 bg-[#FBEFEF] text-maroon'
                  : t.kind === 'success'
                    ? 'border-gold/50 bg-ivory-50 text-ink'
                    : 'border-gold/30 bg-ivory text-ink'
              }`}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  return ctx ?? { show: () => undefined };
}
