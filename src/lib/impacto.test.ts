import { describe, expect, it } from "vitest";
import { planejarObra } from "./cronograma";
import { aplicarMovimento, avaliarPortfolio, simularMovimento } from "./impacto";
import type { Dados } from "./tipos";

let seq = 0;
const id = () => `n${++seq}`;

function base(): Dados {
  return {
    obras: [
      { id: "o1", nome: "Residencial Alfa", cliente: "Cliente A", local: null, data_inicio: "2026-10-01", data_fim_contratual: "2026-10-30", cor: "#000" },
      { id: "o2", nome: "Galpão Beta", cliente: "Cliente B", local: null, data_inicio: "2026-10-01", data_fim_contratual: null, cor: "#000" },
    ],
    etapas: [
      // o1: 10 + 10 dias → termina 20/10, contratual 30/10 (folga 10)
      { id: "e1", obra_id: "o1", nome: "Alvenaria", ordem: 1, duracao_dias: 10, lag_dias: 0, necessidades: [{ funcao: "Pedreiro", quantidade: 2 }] },
      { id: "e2", obra_id: "o1", nome: "Reboco", ordem: 2, duracao_dias: 10, lag_dias: 0, necessidades: [{ funcao: "Pedreiro", quantidade: 2 }] },
      { id: "e3", obra_id: "o2", nome: "Fundação", ordem: 1, duracao_dias: 10, lag_dias: 0, necessidades: [{ funcao: "Pedreiro", quantidade: 1 }] },
    ],
    colaboradores: [
      { id: "c1", nome: "João", funcao: "Pedreiro", telefone: null, ativo: true },
      { id: "c2", nome: "Pedro", funcao: "Pedreiro", telefone: null, ativo: true },
      { id: "c3", nome: "Ana", funcao: "Eletricista", telefone: null, ativo: true },
    ],
    alocacoes: [
      { id: "a1", colaborador_id: "c1", etapa_id: "e1", data_inicio: "2026-10-01", data_fim: "2026-10-10" },
      { id: "a2", colaborador_id: "c2", etapa_id: "e1", data_inicio: "2026-10-01", data_fim: "2026-10-10" },
      { id: "a3", colaborador_id: "c3", etapa_id: "e1", data_inicio: "2026-10-01", data_fim: "2026-10-10" },
    ],
    movimentacoes: [],
  };
}

describe("planejarObra", () => {
  it("encadeia etapas término-início com defasagem", () => {
    const d = base();
    d.etapas[1].lag_dias = -3;
    const p = planejarObra(d.obras[0], d.etapas);
    expect(p.etapas.map((e) => [e.inicio, e.fim])).toEqual([
      ["2026-10-01", "2026-10-10"],
      ["2026-10-08", "2026-10-17"],
    ]);
    expect(p.folgaDias).toBe(13);
  });
});

describe("aplicarMovimento", () => {
  it("divide alocação quando o movimento cai no meio", () => {
    const r = aplicarMovimento(base().alocacoes, { colaborador_id: "c1", etapa_id: "e3", data_inicio: "2026-10-04", data_fim: "2026-10-05" }, id);
    const doC1 = r.filter((a) => a.colaborador_id === "c1").map((a) => [a.etapa_id, a.data_inicio, a.data_fim]);
    expect(doC1).toEqual([
      ["e1", "2026-10-01", "2026-10-03"],
      ["e1", "2026-10-06", "2026-10-10"],
      ["e3", "2026-10-04", "2026-10-05"],
    ]);
  });
});

describe("simularMovimento", () => {
  const hoje = "2026-10-01";

  it("OK quando o colaborador é excedente na origem", () => {
    const r = simularMovimento(base(), { colaborador_id: "c3", etapa_id: null, data_inicio: "2026-10-01", data_fim: "2026-10-10" }, hoje, id);
    expect(r.nivel).toBe("ok");
  });

  it("ATENÇÃO quando o atraso consome folga sem estourar contrato", () => {
    // Tirar 1 de 2 pedreiros por 4 dias → perda 2 dias → obra +2d, folga 10 → 8
    const r = simularMovimento(base(), { colaborador_id: "c1", etapa_id: "e3", data_inicio: "2026-10-01", data_fim: "2026-10-04" }, hoje, id);
    expect(r.nivel).toBe("atencao");
    const item = r.itens.find((i) => i.obraId === "o1")!;
    expect(item.atrasoObraDias).toBe(2);
    expect(item.detalhes.join(" ")).toContain("Reboco (+2d)");
    expect(r.itens.find((i) => i.tipo === "destino")!.nivel).toBe("ok");
  });

  it("CRÍTICO quando estoura o prazo contratual", () => {
    const d = base();
    d.obras[0].data_fim_contratual = "2026-10-21";
    const r = simularMovimento(d, { colaborador_id: "c1", etapa_id: "e3", data_inicio: "2026-10-01", data_fim: "2026-10-10" }, hoje, id);
    expect(r.nivel).toBe("critico");
    expect(r.resumo).toContain("Residencial Alfa");
  });

  it("sugere substitutos livres da mesma função", () => {
    const d = base();
    d.colaboradores.push({ id: "c4", nome: "Rui", funcao: "pedreiro ", telefone: null, ativo: true });
    const r = simularMovimento(d, { colaborador_id: "c1", etapa_id: "e3", data_inicio: "2026-10-01", data_fim: "2026-10-04" }, hoje, id);
    expect(r.itens.find((i) => i.obraId === "o1")!.detalhes.join(" ")).toContain("Substitutos livres no período (Pedreiro): Rui");
  });

  it("sinaliza destino que não demanda a função", () => {
    const r = simularMovimento(base(), { colaborador_id: "c3", etapa_id: "e3", data_inicio: "2026-10-01", data_fim: "2026-10-05" }, hoje, id);
    expect(r.itens.find((i) => i.tipo === "destino")!.nivel).toBe("atencao");
  });
});

describe("avaliarPortfolio", () => {
  it("aponta etapas sem equipe", () => {
    const { alertas } = avaliarPortfolio(base(), "2026-10-01");
    expect(alertas.some((a) => a.etapaId === "e2")).toBe(true);
    expect(alertas.some((a) => a.etapaId === "e1")).toBe(false);
  });
});

describe("destino sem equipe definida", () => {
  it("é OK e orienta a cadastrar a equipe necessária", () => {
    const d = base();
    d.etapas.push({ id: "eg", obra_id: "o2", nome: "Execução geral", ordem: 9, duracao_dias: 30, lag_dias: 0, necessidades: [] });
    const r = simularMovimento(d, { colaborador_id: "c3", etapa_id: "eg", data_inicio: "2026-10-12", data_fim: "2026-10-20" }, "2026-10-01", id);
    expect(r.nivel).toBe("ok");
  });
});
