import { createContext, useCallback, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { User } from "../types";
import { userAPI, type LoginResult } from "@/api/users";
import toast from "react-hot-toast";
import { AUTH_SESSION_EXPIRED_EVENT } from "@/lib/appEvents";
import { watchAppResume } from "@/lib/appResume";
import { isPushPermissionFlowActive } from "@/lib/pushNotificationsSetup";
import { prefetchDashboardData } from "@/lib/prefetchDashboard";
import { invalidateCache } from "@/lib/resourceCache";
import { resetWorkerPushSetupFlag } from "@/lib/pushNotificationsSetup";

type AuthContextType = {
  user: User | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  /** Ricarica profilo da /auth/me (es. dopo aggiornamento schermata checkout in backoffice) */
  refreshUser: () => Promise<User | null>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ✅ Spinner CSS globale (puoi spostarlo in un file esterno se preferisci)
const spinnerStyles = document.createElement("style");
spinnerStyles.innerHTML = `
.loader {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #333;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;
document.head.appendChild(spinnerStyles);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // 👈 blocca il rendering finché non sappiamo lo stato auth

  const refreshUser = useCallback(async (): Promise<User | null> => {
    const me = await userAPI.me();
    if (!me) {
      localStorage.removeItem("auth_user");
      setUser(null);
      return null;
    }
    setUser(me);
    localStorage.setItem("auth_user", JSON.stringify(me));
    return me;
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const result = await userAPI.login(email, password);
    if (!result.user) {
      console.error("Errore login");
      return result;
    }

    invalidateCache();
    setUser(result.user);
    localStorage.setItem("auth_user", JSON.stringify(result.user));
    prefetchDashboardData(result.user);
    return result;
  }, []);

  const logout = useCallback(async () => {
    await userAPI.logout();
    setUser(null);
    localStorage.removeItem("auth_user");
    invalidateCache();
    resetWorkerPushSetupFlag();
  }, []);

  useEffect(() => {
    const onSessionExpired = () => {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      invalidateCache();
      resetWorkerPushSetupFlag();
      setUser(null);
      toast.error("Sessione scaduta. Accedi di nuovo.");
    };
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired);
    return () =>
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired);
  }, []);

  useEffect(() => {
    if (!user) return;
    return watchAppResume(() => {
      if (isPushPermissionFlowActive()) return;
      void (async () => {
        const refreshed = await userAPI.refreshSession();
        const me = refreshed ?? (await refreshUser());
        if (me) prefetchDashboardData(me);
      })();
    });
  }, [user, refreshUser]);

  useEffect(() => {
    let cancelled = false;
    const safetyTimer = window.setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 20_000);

    const init = async () => {
      try {
        let me = await userAPI.refreshSession();
        if (!me) me = await userAPI.me();
        if (cancelled) return;
        if (!me) {
          localStorage.removeItem("auth_user");
          setUser(null);
        } else {
          setUser(me);
          localStorage.setItem("auth_user", JSON.stringify(me));
          prefetchDashboardData(me);
        }
      } finally {
        if (!cancelled) setLoading(false);
        window.clearTimeout(safetyTimer);
      }
    };

    void init();
    return () => {
      cancelled = true;
      window.clearTimeout(safetyTimer);
    };
  }, []);

  // ✨ SPINNER di caricamento
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div className="loader" />
        <p style={{ fontSize: "14px", color: "#666" }}>Caricamento...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve essere usato dentro un AuthProvider");
  }
  return context;
};
