import {
  addDias,
  dentro,
  diffDias,
  fmt,
  fmtCurto,
  maxData,
  minData,
  plural,
  sobrepoe,
} from "./datas";
import {
  indexarEtapas,
  planejarObra,
  planejarTodas,
  type EtapaPlanejada,
  type ObraPlanejada,
} from "./cronograma";
import type { Alocacao, Colaborador, Dados, Movimento, Nivel } from "./tipos";

// ---------------------------------------------------------------------------
// Regras gerais
// ---------------------------------------------------------------------------

const EPS = 1e-9;
const PESO: Record<Nivel, number> = { ok: 0, atencao: 1, critico: 2 };

export function piorNivel(...niveis: Nivel[]): Nivel {
  return niveis.reduce<Nivel>((p, n) => (PESO[n] > PESO[p] ? n : p), "ok");
}

export const normFuncao = (s: string) => s.trim().toLocaleLowerCase("pt-BR");

// ---------------------------------------------------------------------------
// Aplicação do movimento (mesma regra da RPC mover_colaborador no Supabase)
// ---------------------------------------------------------------------------

export function aplicarMovimento(
  alocacoes: Alocacao[],
  mov: Movimento,
  gerarId: () => string = () => crypto.randomUUID(),
): Alocacao[] {
  const resultado: Alocacao[] = [];
  for (const a of alocacoes) {
    if (
      a.colaborador_id !== mov.colaborador_id ||
      !sobrepoe(a.data_inicio, a.data_fim, mov.data_inicio, mov.data_fim)
    ) {
      resultado.push(a);
      continue;
    }
    const sobraAntes = a.data_inicio < mov.data_inicio;
    const sobraDepois = a.data_fim > mov.data_fim;
    if (sobraAntes) resultado.push({ ...a, data_fim: addDias(mov.data_inicio, -1) });
    if (sobraDepois)
      resultado.push({
        ...a,
        id: sobraAntes ? gerarId() : a.id,
        data_inicio: addDias(mov.data_fim, 1),
      });
  }
  if (mov.etapa_id) {
    resultado.push({
      id: gerarId(),
      colaborador_id: mov.colaborador_id,
      etapa_id: mov.etapa_id,
      data_inicio: mov.data_inicio,
      data_fim: mov.data_fim,
    });
  }
  return resultado;
}

// ---------------------------------------------------------------------------
// Cobertura de equipe por etapa
// ---------------------------------------------------------------------------

export interface FaltaFuncao {
  funcao: string;
  maxFalta: number;
  necessario: number;
  primeiroDia: string;
  ultimoDia: string;
}

export interface AnaliseEtapa {
  /**
   * Perda de produção em "dias-etapa": soma, dia a dia, da maior razão falta/necessário
   * entre as funções requeridas (a função mais desfalcada é o gargalo do dia).
   */
  perdaDias: number;
  diasComDeficit: number;
  faltas: FaltaFuncao[];
}

/**
 * Analisa a cobertura de uma etapa entre `aPartirDe` e o fim da etapa.
 * Premissa: produção proporcional à equipe na função-gargalo (lei linear de produtividade).
 */
export function analisarEtapa(
  etapa: EtapaPlanejada,
  alocacoes: Alocacao[],
  colaboradores: Map<string, Colaborador>,
  aPartirDe: string,
): AnaliseEtapa {
  const vazio: AnaliseEtapa = { perdaDias: 0, diasComDeficit: 0, faltas: [] };
  const necessidades = etapa.necessidades.filter((n) => n.quantidade > 0 && n.funcao.trim());
  const ini = maxData(etapa.inicio, aPartirDe);
  if (!necessidades.length || ini > etapa.fim) return vazio;

  const daEtapa = alocacoes
    .filter((a) => a.etapa_id === etapa.id && sobrepoe(a.data_inicio, a.data_fim, ini, etapa.fim))
    .map((a) => ({ a, funcao: normFuncao(colaboradores.get(a.colaborador_id)?.funcao ?? "") }))
    .filter((x) => {
      const c = colaboradores.get(x.a.colaborador_id);
      return c && c.ativo;
    });

  const faltas = new Map<string, FaltaFuncao>();
  let perda = 0;
  let diasDeficit = 0;

  for (let d = ini; d <= etapa.fim; d = addDias(d, 1)) {
    let pior = 0;
    for (const n of necessidades) {
      const alvo = normFuncao(n.funcao);
      const presentes = daEtapa.filter(
        (x) => x.funcao === alvo && dentro(d, x.a.data_inicio, x.a.data_fim),
      ).length;
      const falta = Math.max(0, n.quantidade - presentes);
      if (falta > 0) {
        const f = faltas.get(alvo);
        if (!f) {
          faltas.set(alvo, {
            funcao: n.funcao,
            maxFalta: falta,
            necessario: n.quantidade,
            primeiroDia: d,
            ultimoDia: d,
          });
        } else {
          f.maxFalta = Math.max(f.maxFalta, falta);
          f.ultimoDia = d;
        }
        pior = Math.max(pior, falta / n.quantidade);
      }
    }
    perda += pior;
    if (pior > 0) diasDeficit++;
  }

  return { perdaDias: perda, diasComDeficit: diasDeficit, faltas: [...faltas.values()] };
}

/** Equipe presente num dia versus necessária (total da etapa). */
export function equipeNoDia(
  etapa: EtapaPlanejada,
  alocacoes: Alocacao[],
  colaboradores: Map<string, Colaborador>,
  dia: string,
): { presentes: number; necessario: number } {
  const necessario = etapa.necessidades.reduce((s, n) => s + Math.max(0, n.quantidade), 0);
  const presentes = alocacoes.filter(
    (a) =>
      a.etapa_id === etapa.id &&
      dentro(dia, a.data_inicio, a.data_fim) &&
      colaboradores.get(a.colaborador_id)?.ativo,
  ).length;
  return { presentes, necessario };
}

const diasDeAtraso = (perda: number) => (perda > EPS ? Math.ceil(perda - EPS) : 0);

// ---------------------------------------------------------------------------
// Simulação de remanejamento
// ---------------------------------------------------------------------------

export interface ItemImpacto {
  nivel: Nivel;
  tipo: "validacao" | "origem" | "destino";
  titulo: string;
  detalhes: string[];
  obraId?: string;
  atrasoObraDias?: number;
}

export interface ResultadoImpacto {
  nivel: Nivel;
  resumo: string;
  itens: ItemImpacto[];
  alocacoesResultantes: Alocacao[];
}

export function simularMovimento(
  dados: Dados,
  mov: Movimento,
  hojeISO: string,
  gerarId?: () => string,
): ResultadoImpacto {
  const itens: ItemImpacto[] = [];
  const colabs = new Map(dados.colaboradores.map((c) => [c.id, c]));
  const colab = colabs.get(mov.colaborador_id);
  const planos = planejarTodas(dados);
  const etapasPlan = indexarEtapas(planos);
  const obras = new Map(dados.obras.map((o) => [o.id, o]));

  // ---- Validações --------------------------------------------------------
  if (!colab) {
    return bloqueio("Colaborador não encontrado.", dados.alocacoes);
  }
  if (mov.data_fim < mov.data_inicio) {
    return bloqueio("O término do período é anterior ao início.", dados.alocacoes);
  }
  if (!colab.ativo) {
    itens.push({
      nivel: "atencao",
      tipo: "validacao",
      titulo: `${colab.nome} está inativo`,
      detalhes: ["Colaboradores inativos não contam na cobertura das etapas."],
    });
  }
  const destino = mov.etapa_id ? etapasPlan.get(mov.etapa_id) : undefined;
  if (mov.etapa_id && !destino) {
    return bloqueio("Etapa de destino não encontrada.", dados.alocacoes);
  }
  if (destino && (mov.data_inicio < destino.inicio || mov.data_fim > destino.fim)) {
    itens.push({
      nivel: "atencao",
      tipo: "validacao",
      titulo: "Período fora da janela da etapa de destino",
      detalhes: [
        `A etapa "${destino.nome}" está planejada de ${fmt(destino.inicio)} a ${fmt(destino.fim)}.`,
        "Dias fora dessa janela não geram produção na etapa.",
      ],
    });
  }

  const resultantes = aplicarMovimento(dados.alocacoes, mov, gerarId);
  const aPartirDe = minData(hojeISO, mov.data_inicio);

  // ---- Origens: etapas de onde o colaborador sai --------------------------
  const origens = new Set(
    dados.alocacoes
      .filter(
        (a) =>
          a.colaborador_id === colab.id &&
          a.etapa_id !== mov.etapa_id &&
          sobrepoe(a.data_inicio, a.data_fim, mov.data_inicio, mov.data_fim),
      )
      .map((a) => a.etapa_id),
  );

  const porObra = new Map<string, { etapaId: string; atraso: number; linhas: string[] }[]>();
  const semImpacto: string[] = [];

  for (const etapaId of origens) {
    const etapa = etapasPlan.get(etapaId);
    if (!etapa) continue;
    const antes = analisarEtapa(etapa, dados.alocacoes, colabs, aPartirDe);
    const depois = analisarEtapa(etapa, resultantes, colabs, aPartirDe);
    const atraso = diasDeAtraso(depois.perdaDias - antes.perdaDias);
    const obra = obras.get(etapa.obra_id)!;

    if (atraso === 0) {
      semImpacto.push(`${obra.nome} › ${etapa.nome}`);
      continue;
    }

    const linhas: string[] = [];
    for (const f of depois.faltas) {
      const anterior = antes.faltas.find((x) => normFuncao(x.funcao) === normFuncao(f.funcao));
      if (anterior && anterior.maxFalta >= f.maxFalta && anterior.primeiroDia === f.primeiroDia) continue;
      linhas.push(
        `Etapa "${etapa.nome}": falta ${plural(f.maxFalta, f.funcao)} (de ${f.necessario}) entre ${fmtCurto(f.primeiroDia)} e ${fmtCurto(f.ultimoDia)}.`,
      );
      const livres = livresNoPeriodo(f.funcao, f.primeiroDia, f.ultimoDia, resultantes, dados.colaboradores, colab.id);
      if (livres.length) {
        linhas.push(`Substitutos livres no período (${f.funcao}): ${livres.map((c) => c.nome).join(", ")}.`);
      }
    }
    linhas.push(`Atraso estimado da etapa "${etapa.nome}": ${plural(atraso, "dia")}.`);
    const lista = porObra.get(obra.id) ?? [];
    lista.push({ etapaId, atraso, linhas });
    porObra.set(obra.id, lista);
  }

  for (const [obraId, afetadas] of porObra) {
    itens.push(impactoNaObra(planos.get(obraId)!, dados, afetadas));
  }

  if (semImpacto.length) {
    itens.push({
      nivel: "ok",
      tipo: "origem",
      titulo: "Saída sem impacto",
      detalhes: semImpacto.map(
        (s) => `${s}: equipe continua suficiente para a função ${colab.funcao} (ou função não demandada).`,
      ),
    });
  }
  if (!origens.size) {
    itens.push({
      nivel: "ok",
      tipo: "origem",
      titulo: "Sem conflito de agenda",
      detalhes: [`${colab.nome} não possui outra alocação entre ${fmt(mov.data_inicio)} e ${fmt(mov.data_fim)}.`],
    });
  }

  // ---- Destino -------------------------------------------------------------
  if (destino) {
    itens.push(impactoNoDestino(destino, obras.get(destino.obra_id)!.nome, colab, dados.alocacoes, resultantes, colabs, aPartirDe));
  } else {
    itens.push({
      nivel: "ok",
      tipo: "destino",
      titulo: "Liberação / afastamento",
      detalhes: [`${colab.nome} ficará sem alocação de ${fmt(mov.data_inicio)} a ${fmt(mov.data_fim)}.`],
    });
  }

  const nivel = piorNivel(...itens.map((i) => i.nivel));
  return { nivel, resumo: resumir(nivel, itens, obras), itens, alocacoesResultantes: resultantes };
}

function impactoNaObra(
  plano: ObraPlanejada,
  dados: Dados,
  afetadas: { etapaId: string; atraso: number; linhas: string[] }[],
): ItemImpacto {
  const obra = plano.obra;
  const extra: Record<string, number> = {};
  for (const a of afetadas) extra[a.etapaId] = (extra[a.etapaId] ?? 0) + a.atraso;
  const novo = planejarObra(obra, dados.etapas, extra);
  const deltaObra = diffDias(plano.fimPrevisto, novo.fimPrevisto);

  const detalhes = afetadas.flatMap((a) => a.linhas);
  const deslocadas = novo.etapas
    .filter((e) => !extra[e.id])
    .map((e) => ({ e, d: diffDias(plano.etapas.find((x) => x.id === e.id)!.inicio, e.inicio) }))
    .filter((x) => x.d > 0);
  if (deslocadas.length) {
    detalhes.push(
      `Etapas subsequentes deslocadas: ${deslocadas.map((x) => `${x.e.nome} (+${x.d}d)`).join(", ")} — revise as alocações delas.`,
    );
  }

  let nivel: Nivel = "atencao";
  if (deltaObra > 0) {
    detalhes.push(
      `Término previsto da obra: ${fmt(plano.fimPrevisto)} → ${fmt(novo.fimPrevisto)} (+${plural(deltaObra, "dia")}).`,
    );
    if (obra.data_fim_contratual && novo.fimPrevisto > obra.data_fim_contratual) {
      nivel = "critico";
      detalhes.push(
        `Estoura o prazo contratual (${fmt(obra.data_fim_contratual)}) em ${plural(-(novo.folgaDias ?? 0), "dia")}.`,
      );
    } else if (novo.folgaDias !== null) {
      detalhes.push(`Consome folga contratual: restam ${plural(novo.folgaDias, "dia")}.`);
    }
  } else {
    detalhes.push("Atraso absorvido no pipeline — término previsto da obra mantido.");
  }

  return {
    nivel,
    tipo: "origem",
    obraId: obra.id,
    atrasoObraDias: Math.max(0, deltaObra),
    titulo: `Irá atrapalhar a obra ${obra.nome}${obra.cliente ? ` (cliente ${obra.cliente})` : ""}`,
    detalhes,
  };
}

function impactoNoDestino(
  destino: EtapaPlanejada,
  obraNome: string,
  colab: Colaborador,
  antesAloc: Alocacao[],
  depoisAloc: Alocacao[],
  colabs: Map<string, Colaborador>,
  aPartirDe: string,
): ItemImpacto {
  const onde = `${obraNome} › ${destino.nome}`;
  if (!destino.necessidades.some((n) => n.quantidade > 0)) {
    return {
      nivel: "ok",
      tipo: "destino",
      titulo: `Alocação em ${onde}`,
      detalhes: [
        "A etapa ainda não tem equipe necessária definida — cadastre-a em Obras e pipeline para o app medir falta/excesso.",
      ],
    };
  }
  const demanda = destino.necessidades.find((n) => normFuncao(n.funcao) === normFuncao(colab.funcao));
  if (!demanda || demanda.quantidade <= 0) {
    return {
      nivel: "atencao",
      tipo: "destino",
      titulo: `Destino não demanda ${colab.funcao}`,
      detalhes: [`A função "${colab.funcao}" não consta nas necessidades de ${onde}: alocação excedente.`],
    };
  }
  const antes = analisarEtapa(destino, antesAloc, colabs, aPartirDe);
  const depois = analisarEtapa(destino, depoisAloc, colabs, aPartirDe);
  const ganho = antes.perdaDias - depois.perdaDias;
  if (ganho > EPS) {
    const dias = Math.floor(ganho + EPS);
    return {
      nivel: "ok",
      tipo: "destino",
      titulo: `Reforça ${onde}`,
      detalhes: [
        `Reduz o déficit de ${demanda.funcao} na etapa.`,
        dias > 0
          ? `Recupera ~${plural(dias, "dia")} de produção no cronograma da etapa.`
          : "Ganho de produção inferior a 1 dia no período.",
      ],
    };
  }
  return {
    nivel: "atencao",
    tipo: "destino",
    titulo: `${onde} já está completa em ${demanda.funcao}`,
    detalhes: ["O colaborador ficará excedente no período — avalie outra frente."],
  };
}

/** Colaboradores ativos da função sem nenhuma alocação no período. */
export function livresNoPeriodo(
  funcao: string,
  ini: string,
  fim: string,
  alocacoes: Alocacao[],
  colaboradores: Colaborador[],
  excluirId?: string,
): Colaborador[] {
  const alvo = normFuncao(funcao);
  return colaboradores.filter(
    (c) =>
      c.ativo &&
      c.id !== excluirId &&
      normFuncao(c.funcao) === alvo &&
      !alocacoes.some((a) => a.colaborador_id === c.id && sobrepoe(a.data_inicio, a.data_fim, ini, fim)),
  );
}

function resumir(nivel: Nivel, itens: ItemImpacto[], obras: Map<string, { nome: string }>): string {
  if (nivel === "ok") return "OK — movimentação sem impacto negativo nas obras.";
  const afetadas = itens.filter((i) => i.obraId).map((i) => obras.get(i.obraId!)!.nome);
  if (nivel === "critico") return `CRÍTICO — irá atrapalhar: ${afetadas.join(", ")} (estouro de prazo contratual).`;
  if (afetadas.length) return `ATENÇÃO — impacta: ${afetadas.join(", ")}.`;
  return "ATENÇÃO — verifique os pontos abaixo antes de confirmar.";
}

function bloqueio(msg: string, alocacoes: Alocacao[]): ResultadoImpacto {
  return {
    nivel: "critico",
    resumo: msg,
    itens: [{ nivel: "critico", tipo: "validacao", titulo: msg, detalhes: [] }],
    alocacoesResultantes: alocacoes,
  };
}

// ---------------------------------------------------------------------------
// Saúde do portfólio (alertas contínuos, sem movimento)
// ---------------------------------------------------------------------------

export interface AlertaEtapa {
  nivel: Nivel;
  obraId: string;
  etapaId: string;
  titulo: string;
  detalhes: string[];
}

export interface SaudeObra {
  plano: ObraPlanejada;
  nivel: Nivel;
  analises: Map<string, AnaliseEtapa>;
  riscoAtrasoDias: number;
}

/** Avalia cada obra: déficit de equipe (de hoje até o fim de cada etapa) e risco ao prazo contratual. */
export function avaliarPortfolio(dados: Dados, hojeISO: string): { obras: SaudeObra[]; alertas: AlertaEtapa[] } {
  const colabs = new Map(dados.colaboradores.map((c) => [c.id, c]));
  const planos = planejarTodas(dados);
  const alertas: AlertaEtapa[] = [];
  const obras: SaudeObra[] = [];

  for (const plano of planos.values()) {
    const analises = new Map<string, AnaliseEtapa>();
    const extra: Record<string, number> = {};
    for (const e of plano.etapas) {
      const an = analisarEtapa(e, dados.alocacoes, colabs, hojeISO);
      analises.set(e.id, an);
      const atraso = diasDeAtraso(an.perdaDias);
      if (atraso > 0) extra[e.id] = atraso;
    }
    const projetado = planejarObra(plano.obra, dados.etapas, extra);
    const riscoAtraso = Math.max(0, diffDias(plano.fimPrevisto, projetado.fimPrevisto));
    const estouroPlanejado = plano.folgaDias !== null && plano.folgaDias < 0;
    const estouroProjetado = projetado.folgaDias !== null && projetado.folgaDias < 0;

    let nivelObra: Nivel = "ok";
    for (const e of plano.etapas) {
      const an = analises.get(e.id)!;
      if (!an.faltas.length) continue;
      const proxima = addDias(hojeISO, 30);
      const iminente = an.faltas.some((f) => f.primeiroDia <= proxima);
      const nivel: Nivel = estouroProjetado && iminente ? "critico" : "atencao";
      nivelObra = piorNivel(nivelObra, nivel);
      alertas.push({
        nivel,
        obraId: plano.obra.id,
        etapaId: e.id,
        titulo: `${plano.obra.nome} › ${e.nome}: equipe incompleta`,
        detalhes: [
          ...an.faltas.map(
            (f) => `Falta ${plural(f.maxFalta, f.funcao)} (de ${f.necessario}) entre ${fmtCurto(f.primeiroDia)} e ${fmtCurto(f.ultimoDia)}.`,
          ),
          `Risco de atraso da etapa: ~${plural(diasDeAtraso(an.perdaDias), "dia")}.`,
        ],
      });
    }
    if (estouroPlanejado) {
      nivelObra = "critico";
      alertas.push({
        nivel: "critico",
        obraId: plano.obra.id,
        etapaId: "",
        titulo: `${plano.obra.nome}: pipeline já ultrapassa o prazo contratual`,
        detalhes: [
          `Término previsto ${fmt(plano.fimPrevisto)} × contratual ${fmt(plano.obra.data_fim_contratual)} (${plural(-plano.folgaDias!, "dia")} de estouro).`,
        ],
      });
    }
    obras.push({ plano, nivel: nivelObra, analises, riscoAtrasoDias: riscoAtraso });
  }

  alertas.sort((a, b) => PESO[b.nivel] - PESO[a.nivel]);
  return { obras, alertas };
}

/** Onde cada colaborador está num dia (ou null se disponível). */
export function localizacaoNoDia(
  dados: Dados,
  dia: string,
): Map<string, { alocacao: Alocacao; etapa: EtapaPlanejada; obraNome: string } | null> {
  const etapas = indexarEtapas(planejarTodas(dados));
  const obras = new Map(dados.obras.map((o) => [o.id, o]));
  const mapa = new Map<string, { alocacao: Alocacao; etapa: EtapaPlanejada; obraNome: string } | null>();
  for (const c of dados.colaboradores) mapa.set(c.id, null);
  for (const a of dados.alocacoes) {
    if (!dentro(dia, a.data_inicio, a.data_fim)) continue;
    const etapa = etapas.get(a.etapa_id);
    if (!etapa) continue;
    mapa.set(a.colaborador_id, { alocacao: a, etapa, obraNome: obras.get(etapa.obra_id)?.nome ?? "" });
  }
  return mapa;
}
