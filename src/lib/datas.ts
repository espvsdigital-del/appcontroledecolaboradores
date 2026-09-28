// Datas trabalhadas como strings ISO "YYYY-MM-DD" (sem fuso), em dias corridos.

const DIA_MS = 86_400_000;

function paraMs(d: string): number {
  const [a, m, dd] = d.split("-").map(Number);
  return Date.UTC(a, m - 1, dd);
}

function deMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDias(d: string, n: number): string {
  return deMs(paraMs(d) + n * DIA_MS);
}

/** Dias de `a` até `b` (b − a). */
export function diffDias(a: string, b: string): number {
  return Math.round((paraMs(b) - paraMs(a)) / DIA_MS);
}

export function hoje(): string {
  const n = new Date();
  return deMs(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

export function maxData(a: string, b: string): string {
  return a > b ? a : b;
}

export function minData(a: string, b: string): string {
  return a < b ? a : b;
}

export function sobrepoe(a1: string, a2: string, b1: string, b2: string): boolean {
  return a1 <= b2 && b1 <= a2;
}

export function dentro(d: string, ini: string, fim: string): boolean {
  return ini <= d && d <= fim;
}

export function fmt(d: string | null | undefined): string {
  if (!d) return "—";
  const [a, m, dd] = d.split("-");
  return `${dd}/${m}/${a}`;
}

export function fmtCurto(d: string): string {
  const [, m, dd] = d.split("-");
  return `${dd}/${m}`;
}

export function plural(n: number, singular: string, pluralForma = singular + "s"): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}
