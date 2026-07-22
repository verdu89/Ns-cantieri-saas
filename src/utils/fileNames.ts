const MAX_FILE_NAME_LENGTH = 200;

function stripControlChars(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    out += code <= 0x1f || code === 0x7f ? "_" : char;
  }
  return out;
}

/** Allinea il nome inviato al server (basename, senza path o caratteri di controllo). */
export function sanitizeDisplayFileName(raw: string, fallback = "documento"): string {
  const basename = raw.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? "";
  let cleaned = stripControlChars(basename)
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned === "." || cleaned === "..") {
    cleaned = `${fallback}_${Date.now()}`;
  }

  if (cleaned.length > MAX_FILE_NAME_LENGTH) {
    const dot = cleaned.lastIndexOf(".");
    if (dot > 0 && dot < cleaned.length - 1) {
      const ext = cleaned.slice(dot + 1);
      const stem = cleaned.slice(0, dot);
      const maxStem = MAX_FILE_NAME_LENGTH - ext.length - 1;
      cleaned = `${stem.slice(0, Math.max(1, maxStem))}.${ext}`;
    } else {
      cleaned = cleaned.slice(0, MAX_FILE_NAME_LENGTH);
    }
  }

  return cleaned;
}

export function resolveUploadFileName(file: File, saveAs?: string): string {
  const raw = saveAs ?? file.name;
  return sanitizeDisplayFileName(raw || "documento");
}
