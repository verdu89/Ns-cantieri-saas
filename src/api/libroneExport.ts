import { getApiBaseUrl, tryRefreshSession } from "./httpClient";
import type { OfficeElencoSectionId } from "@/utils/officeElenco";

export type LibroneExportSectionOption = {
  id: OfficeElencoSectionId;
  pdfNumber: number;
  title: string;
  defaultExcluded: boolean;
  rowCount: number;
};

export type LibroneExportDefaults = {
  weekLabel: string;
  lastCommessaCode: string;
  sections: LibroneExportSectionOption[];
};

export type LibroneExportRequest = {
  excludeSections: OfficeElencoSectionId[];
  coverWeekLabel: string;
  coverLastCommessa: string;
};

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem("auth_token");
  const run = () =>
    fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  let response = await run();
  if (response.status === 401 && (await tryRefreshSession())) {
    response = await run();
  }
  return response;
}

export const libroneExportAPI = {
  async defaults(): Promise<LibroneExportDefaults> {
    const response = await authFetch("/librone-export/defaults");
    if (!response.ok) {
      throw new Error("Impossibile caricare opzioni stampa librone");
    }
    return (await response.json()) as LibroneExportDefaults;
  },

  async downloadPdf(request: LibroneExportRequest): Promise<Blob> {
    const response = await authFetch("/librone-export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        excludeSections: request.excludeSections,
        coverWeekLabel: request.coverWeekLabel,
        coverLastCommessa: request.coverLastCommessa,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      let message = "Errore generazione PDF librone";
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
