import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  checkoutOutcomeCopy,
  resolveCheckoutCelebrationMessage,
  type CheckoutOutcome,
} from "@/utils/checkoutCelebration";
import { resolveDocumentUrl } from "@/api/documentAPI";
import { CheckCircle2, Clock3 } from "lucide-react";

export type CheckoutCelebrationFootnote = {
  id: string;
  text: string;
};

const AUTO_CLOSE_MS = 10_000;

type Props = {
  outcome: CheckoutOutcome;
  workerName: string;
  customMessage?: string | null;
  backgroundImageUrl?: string | null;
  jobTitle: string;
  orderCode?: string | null;
  customerName?: string | null;
  footnotes?: CheckoutCelebrationFootnote[];
  onClose: () => void;
  /** Anteprima in backoffice: niente auto-chiusura né pulsante */
  preview?: boolean;
  /** Millisecondi prima della chiusura automatica (0 = disattivata) */
  autoCloseMs?: number;
};

export function CheckoutCelebration({
  outcome,
  workerName,
  customMessage,
  backgroundImageUrl,
  jobTitle,
  orderCode,
  customerName,
  footnotes = [],
  onClose,
  preview = false,
  autoCloseMs = AUTO_CLOSE_MS,
}: Props) {
  const copy = checkoutOutcomeCopy(outcome);
  const message = resolveCheckoutCelebrationMessage(customMessage, workerName);
  const bgUrl = backgroundImageUrl
    ? backgroundImageUrl.startsWith("blob:") || backgroundImageUrl.startsWith("data:")
      ? backgroundImageUrl
      : resolveDocumentUrl(backgroundImageUrl)
    : null;

  const contextParts = [
    orderCode ? `Commessa ${orderCode}` : null,
    customerName ? customerName : null,
    jobTitle ? jobTitle : null,
  ].filter(Boolean);

  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const totalSec =
    !preview && autoCloseMs > 0 ? Math.max(1, Math.ceil(autoCloseMs / 1000)) : 0;
  const [secondsLeft, setSecondsLeft] = useState(totalSec);

  useEffect(() => {
    if (preview || autoCloseMs <= 0) return;

    setSecondsLeft(Math.ceil(autoCloseMs / 1000));
    const started = Date.now();
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const left = Math.max(0, Math.ceil((autoCloseMs - elapsed) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        window.clearInterval(tick);
        closeRef.current();
      }
    }, 200);

    const timeout = window.setTimeout(() => {
      window.clearInterval(tick);
      closeRef.current();
    }, autoCloseMs);

    return () => {
      window.clearInterval(tick);
      window.clearTimeout(timeout);
    };
  }, [preview, autoCloseMs]);

  const progress =
    totalSec > 0 ? Math.min(100, ((totalSec - secondsLeft) / totalSec) * 100) : 0;

  const imagePositionClass = "object-[center_28%]";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl shadow-lg ring-1 ring-slate-900/10"
    >
      <motion.div
        className="relative z-10 flex min-h-[22rem] flex-col sm:min-h-[24rem]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.35 }}
      >
        <motion.div className="relative min-h-[14rem] flex-1 overflow-hidden">
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-brand via-orange-500 to-amber-600"
            initial={{ opacity: 1 }}
            animate={{ opacity: bgUrl ? 0 : 1 }}
          />
          {bgUrl && (
            <>
              <motion.img
                src={bgUrl}
                alt=""
                aria-hidden
                className={`absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-md ${imagePositionClass}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.35 }}
                transition={{ duration: 0.5 }}
              />
              <motion.img
                src={bgUrl}
                alt=""
                className={`absolute inset-0 h-full w-full object-contain ${imagePositionClass}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              />
            </>
          )}
          <motion.div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20" />

          <motion.div className="relative z-10 flex h-full min-h-[14rem] flex-col justify-between p-6 pb-4 text-white sm:p-8 sm:pb-5">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 260, damping: 18 }}
              className="mb-4 inline-flex"
            >
              {copy.tone === "success" ? (
                <CheckCircle2 className="h-12 w-12 text-emerald-300 drop-shadow-lg" strokeWidth={2.2} />
              ) : (
                <Clock3 className="h-12 w-12 text-amber-200 drop-shadow-lg" strokeWidth={2.2} />
              )}
            </motion.div>

            <motion.div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/85">
                {copy.subtitle}
              </p>
              <h2 className="text-2xl font-bold leading-tight drop-shadow-sm sm:text-3xl">
                {copy.title}
              </h2>
              <p className="text-lg font-medium leading-snug text-white drop-shadow-sm sm:text-xl">
                {message}
              </p>
              {contextParts.length > 0 && (
                <p className="text-sm leading-relaxed text-white/90">{contextParts.join(" · ")}</p>
              )}
              {footnotes.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-white/90">
                  {footnotes.map((n) => (
                    <li key={n.id} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
                      <span>{n.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </motion.div>
        </motion.div>

        {!preview && (
          <motion.div
            className="relative z-20 border-t border-white/15 bg-black/55 px-4 py-4 backdrop-blur-md sm:px-6 sm:py-5"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.3 }}
          >
            {autoCloseMs > 0 && (
              <div className="mb-3">
                <div className="mb-1.5 flex justify-between text-xs font-medium text-white/90">
                  <span>Chiusura automatica</span>
                  <span>{secondsLeft > 0 ? `tra ${secondsLeft} s` : "…"}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/25">
                  <motion.div
                    className="h-full rounded-full bg-white"
                    initial={false}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.2, ease: "linear" }}
                  />
                </div>
              </div>
            )}

            <motion.button
              type="button"
              onClick={() => closeRef.current()}
              className="flex w-full items-center justify-center rounded-xl bg-white px-6 py-4 text-lg font-bold tracking-wide text-slate-900 shadow-[0_8px_24px_rgba(0,0,0,0.35)] ring-2 ring-white/80 transition active:scale-[0.98] hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
            >
              OK
            </motion.button>
            <p className="mt-2 text-center text-xs text-white/75">
              {autoCloseMs > 0
                ? "Puoi chiudere subito oppure attendere il conto alla rovescia"
                : "Tocca per tornare all'intervento"}
            </p>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
