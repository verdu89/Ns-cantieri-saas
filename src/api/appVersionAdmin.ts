import { httpClient } from "./httpClient";

export type AndroidVersionRecord = {
  platform: string;
  latestVersionCode: number;
  latestVersionName: string | null;
  minimumVersionCode: number | null;
  releaseNotes: string | null;
  playStoreUrl: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

export type AndroidVersionUpdate = {
  latestVersionCode: number;
  latestVersionName?: string | null;
  minimumVersionCode?: number | null;
  releaseNotes?: string | null;
  playStoreUrl?: string | null;
};

/** Solo super-admin. Ritorna `null` se non è stata ancora configurata nessuna versione. */
export async function fetchAdminAndroidVersion(): Promise<AndroidVersionRecord | null> {
  const res = await httpClient.get<{ android: AndroidVersionRecord | null }>(
    "/admin/app-version"
  );
  return res?.android ?? null;
}

export async function updateAdminAndroidVersion(
  patch: AndroidVersionUpdate
): Promise<AndroidVersionRecord> {
  const res = await httpClient.put<{ android: AndroidVersionRecord }>(
    "/admin/app-version",
    patch
  );
  return res.android;
}
