import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** UI locale: Indonesian (comma decimals, dot thousands — e.g. 5.042,5). */
export const LOCALE = "id-ID";

export const fmt = (n: number | null | undefined, d = 1) =>
  n === null || n === undefined || !Number.isFinite(n) ? "—" : n.toLocaleString(LOCALE, { minimumFractionDigits: d, maximumFractionDigits: d });

/** Full Rupiah amount, e.g. "Rp 80.000". */
export const idr = (n: number) => `Rp ${Math.round(n).toLocaleString(LOCALE)}`;

/**
 * Rupiah in millions, e.g. "Rp 12,5 Juta". Amounts under Rp 1 juta keep two
 * decimals ("Rp 0,85 Juta") so small per-batch losses are still readable.
 */
export const idrJuta = (n: number) => `Rp ${fmt(n / 1e6, Math.abs(n) < 1e6 ? 2 : 1)} Juta`;
