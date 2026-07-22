// Validação padronizada de datas em formulários.
// Datas são armazenadas como strings ISO "YYYY-MM-DD" (input type="date").

export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;
export const MIN_DATE = `${MIN_YEAR}-01-01`;
export const MAX_DATE = `${MAX_YEAR}-12-31`;
export const MIN_DATE_OBJ = new Date(MIN_YEAR, 0, 1);
export const MAX_DATE_OBJ = new Date(MAX_YEAR, 11, 31);

export const DATE_RANGE_MESSAGE =
  "Data inválida. Selecione uma data entre 01/01/2000 e 31/12/2100.";

export type DateValidationResult = { ok: true } | { ok: false; message: string };

/** Valida uma string de data ISO (YYYY-MM-DD). Vazio é considerado válido — use `required` no input para exigir. */
export function validateDateString(value: string | null | undefined): DateValidationResult {
  if (value == null || value === "") return { ok: true };
  const s = String(value).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return { ok: false, message: DATE_RANGE_MESSAGE };
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < MIN_YEAR || y > MAX_YEAR) return { ok: false, message: DATE_RANGE_MESSAGE };
  if (mo < 1 || mo > 12) return { ok: false, message: DATE_RANGE_MESSAGE };
  if (d < 1 || d > 31) return { ok: false, message: DATE_RANGE_MESSAGE };
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    return { ok: false, message: DATE_RANGE_MESSAGE };
  }
  return { ok: true };
}

export function isDateValid(value: string | null | undefined): boolean {
  return validateDateString(value).ok;
}

/** Converte "YYYY-MM-DD" para Date local (sem timezone shift). */
export function isoToDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Converte Date para "YYYY-MM-DD" local. */
export function dateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

