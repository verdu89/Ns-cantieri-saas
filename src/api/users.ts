import type { User } from "../types";
import { httpClient, tryRefreshSession } from "./httpClient";

type LoginResponse = {
  token: string;
  user: User;
};

export type LoginErrorCode =
  | "INVALID_CREDENTIALS"
  | "NETWORK_ERROR"
  | "TOO_MANY_ATTEMPTS"
  | "TENANT_SUSPENDED"
  | "TRIAL_EXPIRED"
  | "PAYMENT_OVERDUE"
  | "UNKNOWN";

export type LoginResult = {
  user: User | null;
  errorCode?: LoginErrorCode;
};

export const userAPI = {
  async login(email: string, password: string): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const res = await httpClient.post<LoginResponse>("/auth/login", {
        email: normalizedEmail,
        password,
      });
      localStorage.setItem("auth_token", res.token);
      return { user: res.user };
    } catch (error) {
      const raw = (error as { message?: string } | undefined)?.message ?? "";
      const parts = raw.split(":");
      const status = parts[0]?.trim();
      const bodyRaw = parts.slice(1).join(":").trim();

      if (!/^\d{3}$/.test(status)) {
        return { user: null, errorCode: "NETWORK_ERROR" };
      }

      let code: LoginErrorCode = "UNKNOWN";
      try {
        const parsed = JSON.parse(bodyRaw) as { message?: string; code?: string };
        if (parsed.code === "TRIAL_EXPIRED") code = "TRIAL_EXPIRED";
        else if (parsed.code === "PAYMENT_OVERDUE") code = "PAYMENT_OVERDUE";
        else if (parsed.code === "TENANT_SUSPENDED") code = "TENANT_SUSPENDED";
        else if (parsed.code === "TOO_MANY_ATTEMPTS") code = "TOO_MANY_ATTEMPTS";
      } catch {
        // ignore parse error
      }
      if (status === "401") code = "INVALID_CREDENTIALS";
      if (status === "403" && code === "UNKNOWN") code = "TENANT_SUSPENDED";
      if (status === "429" && code === "UNKNOWN") code = "TOO_MANY_ATTEMPTS";
      return { user: null, errorCode: code };
    }
  },

  async logout(): Promise<void> {
    localStorage.removeItem("auth_token");
  },

  async me(): Promise<User | null> {
    try {
      const user = await httpClient.get<User>("/auth/me");
      return user;
    } catch {
      return null;
    }
  },

  /** Estende la sessione senza password (utile all'apertura dell'app). */
  async refreshSession(): Promise<User | null> {
    const ok = await tryRefreshSession();
    if (!ok) return null;
    try {
      const user = await httpClient.get<User>("/auth/me");
      if (user) {
        localStorage.setItem("auth_user", JSON.stringify(user));
      }
      return user;
    } catch {
      return null;
    }
  },

  async changePassword(newPassword: string): Promise<void> {
    await httpClient.post("/auth/change-password", { newPassword });
  },

  async resetPassword(workerId: string, newPassword: string): Promise<void> {
    await httpClient.post("/auth/reset-password", { workerId, newPassword });
  },
};
