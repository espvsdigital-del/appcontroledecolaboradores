import { planejarObra } from "../cronograma";
import { addDias, hoje, sobrepoe } from "../datas";
import { aplicarMovimento, normFuncao } from "../impacto";
import type { Alocacao, Colaborador, Dados, Etapa, Obra } from "../tipos";
import type { Repositorio } from "./tipos";

// Modo demonstração: dados no localStorage do navegador.
// Sincroniza entre abas via BroadcastChannel (simula o tempo real do Supabase).

const CHAVE = "mapa-equipes:demo:v1";
const CANAL = "mapa-equipes";

const uid = () => crypto.randomUUID();

function ler(): Dados {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) return JSON.parse(bruto) as Dados;
  } catch {
    // armazenamento indisponível → dados em memória
  }
  const d = dadosExemplo();
  gravar(d, false);
  return d;
}

let memoria: Dados | null = null;
const ouvintes = new Set<() => void>();
let canal: BroadcastChannel | null = null;

function gravar(d: Dados, notificar = true) {
  memoria = d;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(d));
  } catch {
    // ignora
  }
  if (notificar) {
    ouvintes.forEach((f) => f());
    canal?.postMessage("mudou");
  }
}

function atual(): Dados {
  if (!memoria) memoria = ler();
  return memoria;
}

function upsert<T extends { id: string }>(lista: T[], item: T): T[] {
  const i = lista.findIndex((x) => x.id === item.id);
  if (i < 0) return [...lista, item];
  const copia = [...lista];
  copia[i] = item;
  return copia;
}

export function restaurarDemo() {
  gravar(dadosExemplo());
}

export function criarRepositorioDemo(): Repositorio {
  return {
    modo: "demo",
    async carregar() {
      memoria = ler();
      return structuredClone(memoria);
    },
    assinar(aoMudar) {
      ouvintes.add(aoMudar);
      if (!canal && typeof BroadcastChannel !== "undefined") {
        canal = new BroadcastChannel(CANAL);
        canal.onmessage = () => {
          memoria = null;
          ouvintes.forEach((f) => f());
        };
      }
      return () => ouvintes.delete(aoMudar);
    },
    async salvarObra(o) {
      const d = atual();
      gravar({ ...d, obras: upsert(d.obras, o) });
    },
    async excluirObra(id) {
      const d = atual();
      const etapas = new Set(d.etapas.filter((e) => e.obra_id === id).map((e) => e.id));
      gravar({
        ...d,
        obras: d.obras.filter((o) => o.id !== id),
        etapas: d.etapas.filter((e) => !etapas.has(e.id)),
        alocacoes: d.alocacoes.filter((a) => !etapas.has(a.etapa_id)),
      });
    },
    async salvarEtapa(e) {
      const d = atual();
      gravar({ ...d, etapas: upsert(d.etapas, e) });
    },
    async excluirEtapa(id) {
      const d = atual();
      gravar({
        ...d,
        etapas: d.etapas.filter((e) => e.id !== id),
        alocacoes: d.alocacoes.filter((a) => a.etapa_id !== id),
      });
    },
    async salvarColaborador(c) {
      const d = atual();
      gravar({ ...d, colaboradores: upsert(d.colaboradores, c) });
    },
    async excluirColaborador(id) {
      const d = atual();
      gravar({
        ...d,
        colaboradores: d.colaboradores.filter((c) => c.id !== id),
        alocacoes: d.alocacoes.filter((a) => a.colaborador_id !== id),
      });
    },
    async excluirAlocacao(id) {
      const d = atual();
      gravar({ ...d, alocacoes: d.alocacoes.filter((a) => a.id !== id) });
    },
    async moverColaborador(m) {
      const d = atual();
      gravar({
        ...d,
        alocacoes: aplicarMovimento(d.alocacoes, m, uid),
        movimentacoes: [
          {
            id: uid(),
            colaborador_id: m.colaborador_id,
            etapa_id: m.etapa_id,
            data_inicio: m.data_inicio,
            data_fim: m.data_fim,
            motivo: m.motivo,
            nivel: m.nivel,
            resumo: m.resumo,
            created_at: new Date().toISOString(),
          },
          ...d.movimentacoes,
        ],
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Dados de exemplo (datas relativas a hoje)
// ---------------------------------------------------------------------------

function dadosExemplo(): Dados {
  const t = hoje();
  const obras: Obra[] = [];
  const etapas: Etapa[] = [];

  function obra(
    nome: string,
    cliente: string,
    local: string,
    inicioRel: number,
    cor: string,
    lista: [string, number, number, [string, number][]][],
    folga: number,
  ) {
    const o: Obra = { id: uid(), nome, cliente, local, data_inicio: addDias(t, inicioRel), data_fim_contratual: null, cor };
    lista.forEach(([n, dur, lag, nec], i) =>
      etapas.push({
        id: uid(),
        obra_id: o.id,
        nome: n,
        ordem: i + 1,
        duracao_dias: dur,
        lag_dias: lag,
        necessidades: nec.map(([funcao, quantidade]) => ({ funcao, quantidade })),
      }),
    );
    o.data_fim_contratual = addDias(planejarObra(o, etapas).fimPrevisto, folga);
    obras.push(o);
  }

  obra("Residencial Vila Verde", "Incorporadora Horizonte", "Pouso Alegre/MG", -20, "#2563eb", [
    ["Fundação", 15, 0, [["Pedreiro", 2], ["Servente", 2], ["Armador", 1]]],
    ["Estrutura", 25, 0, [["Armador", 2], ["Carpinteiro", 2], ["Pedreiro", 1], ["Servente", 2]]],
    ["Alvenaria", 30, 0, [["Pedreiro", 3], ["Servente", 2]]],
    ["Instalações", 20, -10, [["Eletricista", 1], ["Encanador", 1]]],
  ], 8);

  obra("Galpão Logístico LG-02", "LogBR Armazéns", "Extrema/MG", -5, "#16a34a", [
    ["Terraplenagem", 10, 0, [["Operador de máquinas", 1], ["Servente", 2]]],
    ["Fundação", 20, 0, [["Armador", 1], ["Pedreiro", 2], ["Servente", 1]]],
    ["Estrutura metálica", 25, 0, [["Montador", 3]]],
  ], 15);

  obra("Clínica São Lucas — Reforma", "Clínica São Lucas", "Pouso Alegre/MG", 3, "#db2777", [
    ["Demolição", 5, 0, [["Servente", 2]]],
    ["Alvenaria e drywall", 12, 0, [["Pedreiro", 2]]],
    ["Instalações", 10, -4, [["Eletricista", 1], ["Encanador", 1]]],
    ["Acabamento", 10, 0, [["Pintor", 2], ["Pedreiro", 1]]],
  ], 2);

  const pessoas: [string, string][] = [
    ["João Silva", "Pedreiro"], ["Carlos Souza", "Pedreiro"], ["Marcos Lima", "Pedreiro"],
    ["Antônio Pereira", "Pedreiro"], ["Rafael Costa", "Pedreiro"],
    ["José Santos", "Servente"], ["Lucas Oliveira", "Servente"], ["Diego Alves", "Servente"], ["Paulo Rocha", "Servente"],
    ["Fernando Dias", "Armador"], ["Ricardo Nunes", "Armador"],
    ["Sérgio Mendes", "Carpinteiro"], ["André Barros", "Carpinteiro"],
    ["Bruno Teixeira", "Eletricista"], ["Felipe Moraes", "Eletricista"],
    ["Gustavo Ramos", "Encanador"],
    ["Roberto Freitas", "Operador de máquinas"],
    ["Eduardo Cardoso", "Montador"], ["Thiago Martins", "Montador"], ["Vinícius Araújo", "Montador"],
    ["Márcio Castro", "Pintor"],
  ];
  const colaboradores: Colaborador[] = pessoas.map(([nome, funcao]) => ({
    id: uid(),
    nome,
    funcao,
    telefone: null,
    ativo: true,
  }));

  // Alocação gulosa: preenche cada etapa com quem estiver livre no período inteiro.
  // A escassez proposital de algumas funções gera déficits para demonstrar os alertas.
  const alocacoes: Alocacao[] = [];
  for (const o of obras) {
    for (const e of planejarObra(o, etapas).etapas) {
      for (const n of e.necessidades) {
        const livres = colaboradores.filter(
          (c) =>
            normFuncao(c.funcao) === normFuncao(n.funcao) &&
            !alocacoes.some(
              (a) => a.colaborador_id === c.id && sobrepoe(a.data_inicio, a.data_fim, e.inicio, e.fim),
            ),
        );
        for (const c of livres.slice(0, n.quantidade)) {
          alocacoes.push({ id: uid(), colaborador_id: c.id, etapa_id: e.id, data_inicio: e.inicio, data_fim: e.fim });
        }
      }
    }
  }

  return { obras, etapas, colaboradores, alocacoes, movimentacoes: [] };
}
