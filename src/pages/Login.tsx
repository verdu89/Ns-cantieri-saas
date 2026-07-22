import { Button } from "@/components/ui/Button";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { LoginErrorCode } from "@/api/users";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
const fieldShell =
  "flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-[15px] text-white shadow-inner shadow-black/20 outline-none ring-0 transition placeholder:text-slate-500 focus-within:border-orange-400/50 focus-within:bg-slate-950/60 focus-within:ring-2 focus-within:ring-orange-400/25";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("remember_email");
    const savedPassword = localStorage.getItem("remember_password");
    if (savedEmail && savedPassword) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setRemember(true);
    }
  }, []);

  const getHomeRoute = (u: { role: string; isPlatformAdmin?: boolean }) => {
    if (u.isPlatformAdmin) return "/backoffice/super-admin";
    if (u.role === "worker") return "/agenda";
    return "/backoffice/home";
  };

  const getLoginErrorMessage = (code?: LoginErrorCode) => {
    if (code === "NETWORK_ERROR") {
      return "Impossibile contattare il server. Verifica Wi‑Fi, che il backend sia avviato e che l'APK punti all'IP corretto.";
    }
    if (code === "TOO_MANY_ATTEMPTS") {
      return "Troppi tentativi falliti. Attendi qualche minuto e riprova.";
    }
    if (code === "TRIAL_EXPIRED") {
      return "Il periodo di prova è terminato. Contatta l'amministrazione per proseguire.";
    }
    if (code === "PAYMENT_OVERDUE") {
      return "Account sospeso per pagamento scaduto. Contatta l'amministrazione.";
    }
    if (code === "TENANT_SUSPENDED") {
      return "Account temporaneamente sospeso. Contatta l'amministrazione.";
    }
    return "Credenziali non valide.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(email, password);

    if (!result.user) {
      setError(getLoginErrorMessage(result.errorCode));
      setLoading(false);
      return;
    }

    if (remember) {
      localStorage.setItem("remember_email", email);
      localStorage.setItem("remember_password", password);
    } else {
      localStorage.removeItem("remember_email");
      localStorage.removeItem("remember_password");
    }

    setLoading(false);
    navigate(getHomeRoute(result.user), { replace: true });
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-2 text-center sm:text-left">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-300/90">
          Area riservata
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[1.65rem]">
          Accedi
        </h1>
        <p className="text-sm leading-relaxed text-slate-400">
          Inserisci email e password per entrare nell&apos;applicazione.
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          className="flex gap-3 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100 ring-1 ring-red-400/20"
        >
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-red-300"
            strokeWidth={2}
            aria-hidden
          />
          <span className="leading-snug">{error}</span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="space-y-2">
          <label
            htmlFor="login-email"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
          >
            Email
          </label>
          <div className={fieldShell}>
            <Mail
              className="h-[18px] w-[18px] shrink-0 text-slate-500"
              strokeWidth={2}
              aria-hidden
            />
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="nome@azienda.it"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-slate-500"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="login-password"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
            >
              Password
            </label>
          </div>
          <div className={fieldShell}>
            <Lock
              className="h-[18px] w-[18px] shrink-0 text-slate-500"
              strokeWidth={2}
              aria-hidden
            />
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-slate-500"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
              aria-label={showPassword ? "Nascondi password" : "Mostra password"}
            >
              {showPassword ? (
                <EyeOff className="h-[18px] w-[18px]" strokeWidth={2} />
              ) : (
                <Eye className="h-[18px] w-[18px]" strokeWidth={2} />
              )}
            </button>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-transparent py-0.5 transition hover:border-white/5">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-slate-950/50 text-orange-500 focus:ring-2 focus:ring-orange-400/40 focus:ring-offset-0 focus:ring-offset-transparent"
          />
          <span className="text-left text-sm leading-snug text-slate-400">
            <span className="font-medium text-slate-300">Ricorda credenziali</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Solo su dispositivo personale e ambiente attendibile.
            </span>
          </span>
        </label>

        <Button
          type="submit"
          disabled={loading}
          className="group relative mt-1 w-full overflow-hidden rounded-2xl border border-orange-400/20 bg-gradient-to-r from-orange-500 to-amber-600 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-orange-900/30 transition hover:from-orange-600 hover:to-amber-700 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <span className="relative z-10 inline-flex items-center justify-center gap-2">
            {loading ? (
              <>
                <Loader2
                  className="h-5 w-5 animate-spin"
                  strokeWidth={2}
                  aria-hidden
                />
                Accesso in corso…
              </>
            ) : (
              "Entra"
            )}
          </span>
        </Button>
      </form>
    </div>
  );
};

export default Login;
