import { getApiBaseUrl, httpClient, tryRefreshSession } from "./httpClient";
import { fetchWithResilience } from "@/utils/resilientRequest";
import type { CheckoutHeaderLayout } from "@/config/checkoutHeaderLayout";

export type CheckoutSettings = {
  checkoutDigitalEnabled: boolean;
  companyName: string | null;
  subtitle: string | null;
  legalText: string | null;
  footerWebsite: string | null;
  logoUrl: string | null;
  headerLayout: string | null;
  brandColor: string | null;
};

export type CheckoutSettingsUpdate = {
  companyName?: string | null;
  subtitle?: string | null;
  legalText?: string | null;
  footerWebsite?: string | null;
  headerLayout?: CheckoutHeaderLayout | null;
  brandColor?: string | null;
};

export const checkoutSettingsAPI = {
  get(): Promise<CheckoutSettings> {
    return httpClient.get<CheckoutSettings>("/checkout-settings");
  },

  update(payload: CheckoutSettingsUpdate): Promise<CheckoutSettings> {
    return httpClient.put<CheckoutSettings>("/checkout-settings", payload);
  },

  uploadLogo(imageDataUrl: string): Promise<CheckoutSettings> {
    return httpClient.post<CheckoutSettings>("/checkout-settings/logo", { imageDataUrl });
  },

  deleteLogo(): Promise<CheckoutSettings> {
    return httpClient.delete<CheckoutSettings>("/checkout-settings/logo");
  },

  async previewPdf(payload: CheckoutSettingsUpdate): Promise<Blob> {
    const path = "/checkout-settings/pdf-preview";
    const run = async () => {
      const token = localStorage.getItem("auth_token");
      return fetchWithResilience(`${getApiBaseUrl()}${path}`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    };

    let response = await run();
    if (response.status === 401 && (await tryRefreshSession())) {
      response = await run();
    }
    if (!response.ok) {
      const text = await response.text();
      let message = "Errore generazione anteprima PDF";
      try {
        const parsed = JSON.parse(text) as { message?: string };
        if (parsed.message) message = parsed.message;
      } catch {
        if (text.trim()) message = text;
      }
      throw new Error(message);
    }
    return response.blob();
  },
};
