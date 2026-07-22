import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { ClipboardList, LayoutDashboard, Shield } from "lucide-react";
import logo from "@/assets/logo.png";

const highlights = [
  {
    icon: LayoutDashboard,
    title: "Dashboard operativa",
    text: "Cantieri, ordini e documenti in un unico flusso.",
  },
  {
    icon: ClipboardList,
    title: "Agenda e interventi",
    text: "Pianificazione chiara per team in campo e in ufficio.",
  },
  {
    icon: Shield,
    title: "Dati protetti",
    text: "Accesso controllato per tenant e ruoli.",
  },
];

export default function AuthLayout() {
  return (
    <div className="cap-auth-shell relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-slate-950 text-slate-100 lg:flex-row pt-[var(--safe-area-inset-top,env(safe-area-inset-top,0px))] pb-[var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px))]">
      {/* Ambient */}
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        aria-hidden
      >
        <div className="absolute -left-[20%] top-0 h-[min(70vh,520px)] w-[min(70vw,520px)] rounded-full bg-orange-500/25 blur-[120px]" />
        <div className="absolute -right-[10%] bottom-0 h-[min(60vh,440px)] w-[min(65vw,480px)] rounded-full bg-sky-500/15 blur-[100px]" />
        <div className="absolute left-1/2 top-1/2 h-px w-[120%] -translate-x-1/2 -translate-y-1/2 rotate-[-12deg] bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
      </div>
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:56px_56px]"
        aria-hidden
      />

      {/* Brand column */}
      <aside className="relative z-10 order-2 hidden w-[min(100%,520px)] shrink-0 flex-col justify-between border-white/5 lg:order-1 lg:flex lg:w-[46%] lg:border-r xl:w-1/2">
        <div className="flex flex-1 flex-col justify-center px-10 py-14 xl:px-16 xl:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-md"
          >
            <div className="mb-10">
              <div className="relative inline-block max-w-full">
                <div
                  className="pointer-events-none absolute -inset-2 rounded-[1.25rem] bg-gradient-to-br from-orange-500/35 via-amber-500/15 to-transparent opacity-70 blur-xl"
                  aria-hidden
                />
                <div className="relative rounded-2xl border border-orange-500/30 bg-slate-900/70 px-6 py-5 shadow-lg shadow-orange-950/50 ring-1 ring-orange-400/15 backdrop-blur-sm">
                  <img
                    src={logo}
                    alt="Ns-cantieri"
                    className="h-[52px] w-auto max-w-[min(100%,300px)] object-contain object-left sm:h-14 lg:h-[3.85rem]"
                  />
                </div>
              </div>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
                Piattaforma{" "}
                <span className="font-medium text-orange-400/95">SaaS</span> per
                team in cantiere e in ufficio.
              </p>
            </div>

            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-white xl:text-[2.75rem]">
              Gestione cantieri,
              <span className="mt-1 block bg-gradient-to-r from-orange-200 via-amber-200 to-orange-100 bg-clip-text text-transparent">
                pensata per operare.
              </span>
            </h1>
            <p className="mt-6 text-base leading-relaxed text-slate-400">
              Un&apos;unica piattaforma per backoffice, amministratori e squadre
              in cantiere: meno attrito, più tracciabilità.
            </p>

            <ul className="mt-12 space-y-5">
              {highlights.map(({ icon: Icon, title, text }, i) => (
                <motion.li
                  key={title}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: 0.15 + i * 0.08,
                    duration: 0.45,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="flex gap-4"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-orange-300/95 ring-1 ring-white/5">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-100">
                      {title}
                    </span>
                    <span className="mt-0.5 block text-sm text-slate-500">
                      {text}
                    </span>
                  </span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
        <p className="px-10 pb-8 text-xs text-slate-600 xl:px-16">
          © {new Date().getFullYear()} Ns-cantieri. Tutti i diritti riservati.
        </p>
      </aside>

      {/* Form column */}
      <main className="relative z-10 order-1 flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-8 lg:order-2 lg:px-12">
        <div className="mb-8 flex w-full max-w-[420px] flex-col items-center lg:hidden">
          <div className="relative">
            <div
              className="pointer-events-none absolute -inset-2 rounded-[1.25rem] bg-gradient-to-br from-orange-500/35 via-amber-500/15 to-transparent opacity-60 blur-xl"
              aria-hidden
            />
            <div className="relative rounded-2xl border border-orange-500/30 bg-slate-900/70 px-5 py-4 shadow-lg shadow-orange-950/50 ring-1 ring-orange-400/15 backdrop-blur-sm">
              <img
                src={logo}
                alt="Ns-cantieri"
                className="h-12 w-auto max-w-[260px] object-contain"
              />
            </div>
          </div>
          <p className="mt-4 text-center text-sm text-slate-400">
            Accedi per continuare
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[420px] rounded-3xl border border-white/10 bg-white/[0.07] p-8 shadow-2xl shadow-black/40 ring-1 ring-white/10 backdrop-blur-xl sm:p-9"
        >
          <Outlet />
        </motion.div>

        <p className="mt-8 max-w-[420px] text-center text-[11px] leading-relaxed text-slate-500">
          Accesso riservato a utenti autorizzati. Le credenziali sono gestite dal
          referente del tuo tenant.
        </p>
      </main>
    </div>
  );
}
