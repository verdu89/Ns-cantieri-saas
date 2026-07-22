/** Codice commessa nel PDF librone Access: `6-058` (= 2026). */
const LIBRONE_CODE_RE = /^(\d)-(\d{3})$/;
const PROGRAM_CODE_RE = /^(\d{2})-(\d{3})$/;

export function programCodeToLibrone(code: string): string {
  const trimmed = code.trim().toUpperCase();
  const m = trimmed.match(PROGRAM_CODE_RE);
  if (!m) return trimmed;
  return `${m[1].slice(-1)}-${m[2]}`;
}

export function libroneCodeToProgram(code: string): string {
  const trimmed = code.trim().toUpperCase();
  if (PROGRAM_CODE_RE.test(trimmed)) return trimmed;
  const m = trimmed.match(LIBRONE_CODE_RE);
  if (!m) return trimmed;
  return `2${m[1]}-${m[2]}`;
}
