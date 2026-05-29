import { getApiBaseUrl } from "./httpClient";

export type AndroidVersionInfo = {
  latestVersionCode?: number;
  latestVersionName?: string;
  minimumVersionCode?: number;
  releaseNotes?: string;
  playStoreUrl: string;
};

export type AppVersionInfo = {
  android: AndroidVersionInfo;
};

/**
 * Rotta pubblica del backend: non richiede auth. Usata dalla modale "Aggiorna ora".
 * In caso di errore di rete o backend, ritorna `null` e il client semplicemente non mostra nulla.
 */
export async function fetchAppVersionInfo(
  signal?: AbortSignal
): Promise<AppVersionInfo | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/app/version`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as AppVersionInfo;
    if (!data?.android) return null;
    return data;
  } catch {
    return null;
  }
}
