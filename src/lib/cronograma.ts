import { addDias, diffDias } from "./datas";
import type { Dados, Etapa, Obra } from "./tipos";

export interface EtapaPlanejada extends Etapa {
  inicio: string;
  fim: string;
}

export interface ObraPlanejada {
  obra: Obra;
  etapas: EtapaPlanejada[];
  inicio: string;
  fimPrevisto: string;
  /** Dias entre o término previsto e o contratual (negativo = estouro). null se não há prazo contratual. */
  folgaDias: number | null;
}

/**
 * Monta o pipeline da obra: etapas em sequência (por `ordem`), relação término-início
 * com a anterior + defasagem (`lag_dias`). `extraDuracao` permite simular atrasos por etapa.
 */
export function planejarObra(
  obra: Obra,
  etapas: Etapa[],
  extraDuracao: Record<string, number> = {},
): ObraPlanejada {
  const lista = etapas
    .filter((e) => e.obra_id === obra.id)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));

  const planejadas: EtapaPlanejada[] = [];
  let fimAnterior: string | null = null;
  for (const e of lista) {
    const duracao = Math.max(1, e.duracao_dias + (extraDuracao[e.id] ?? 0));
    let inicio =
      fimAnterior === null
        ? addDias(obra.data_inicio, Math.max(0, e.lag_dias))
        : addDias(fimAnterior, 1 + e.lag_dias);
    if (inicio < obra.data_inicio) inicio = obra.data_inicio;
    const fim = addDias(inicio, duracao - 1);
    planejadas.push({ ...e, inicio, fim });
    fimAnterior = fim;
  }

  const fimPrevisto = planejadas.reduce(
    (m, e) => (e.fim > m ? e.fim : m),
    planejadas[0]?.fim ?? obra.data_inicio,
  );

  return {
    obra,
    etapas: planejadas,
    inicio: obra.data_inicio,
    fimPrevisto,
    folgaDias: obra.data_fim_contratual ? diffDias(fimPrevisto, obra.data_fim_contratual) : null,
  };
}

export function planejarTodas(dados: Pick<Dados, "obras" | "etapas">): Map<string, ObraPlanejada> {
  const mapa = new Map<string, ObraPlanejada>();
  for (const o of dados.obras) mapa.set(o.id, planejarObra(o, dados.etapas));
  return mapa;
}

export function indexarEtapas(planos: Map<string, ObraPlanejada>): Map<string, EtapaPlanejada> {
  const mapa = new Map<string, EtapaPlanejada>();
  for (const p of planos.values()) for (const e of p.etapas) mapa.set(e.id, e);
  return mapa;
}
