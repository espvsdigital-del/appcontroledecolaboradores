import type { Necessidade } from "./tipos";

export function necessidadesParaTexto(n: Necessidade[]): string {
  return n.map((x) => `${x.quantidade} ${x.funcao}`).join(", ");
}

/** "3 Pedreiro, 2 Servente" → [{ funcao: "Pedreiro", quantidade: 3 }, ...] */
export function textoParaNecessidades(t: string): Necessidade[] {
  return t
    .split(/[,;\n]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = p.match(/^(\d+)\s*[x×]?\s*(.+)$/i);
      return m ? { funcao: m[2].trim(), quantidade: Number(m[1]) } : { funcao: p, quantidade: 1 };
    });
}
