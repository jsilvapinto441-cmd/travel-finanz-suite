// Validação padronizada de datas em formulários.
// Datas são armazenadas como strings ISO "YYYY-MM-DD" (input type="date").

export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;
export const MIN_DATE = `${MIN_YEAR}-01-01`;
export const MAX_DATE = `${MAX_YEAR}-12-31`;

export type DateValidationResult = { ok: true } | { ok: false; message: string };

/** Valida uma string de data ISO (YYYY-MM-DD). Vazio é considerado válido — use `required` no input para exigir. */
export function validateDateString(value: string | null | undefined): DateValidationResult {
  if (value == null || value === "") return { ok: true };
  const s = String(value).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return { ok: false, message: "Data inválida." };
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < MIN_YEAR || y > MAX_YEAR) {
    return { ok: false, message: `O ano informado está fora do intervalo permitido (${MIN_YEAR} a ${MAX_YEAR}).` };
  }
  if (mo < 1 || mo > 12) return { ok: false, message: "Data inválida." };
  if (d < 1 || d > 31) return { ok: false, message: "Data inválida." };
  // Verifica se o dia realmente existe no mês (ex.: 31/02).
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    return { ok: false, message: "Data inválida." };
  }
  return { ok: true };
}

export function isDateValid(value: string | null | undefined): boolean {
  return validateDateString(value).ok;
}
