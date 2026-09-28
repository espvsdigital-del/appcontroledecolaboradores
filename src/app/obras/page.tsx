"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useDados } from "@/components/DadosProvider";
import { NivelBadge } from "@/components/Nivel";
import Pipeline from "@/components/Pipeline";
import { fmt, hoje as hojeFn, plural } from "@/lib/datas";
import { avaliarPortfolio } from "@/lib/impacto";
import { necessidadesParaTexto, textoParaNecessidades } from "@/lib/necessidades";
import type { Etapa, Obra } from "@/lib/tipos";

const CORES = ["#2563eb", "#16a34a", "#db2777", "#9333ea", "#0891b2", "#ea580c", "#4f46e5", "#65a30d"];

export default function PaginaObras() {
  const { dados, repo, carregando } = useDados();
  const hoje = hojeFn();
  const [editando, setEditando] = useState<Obra | null>(null);
  const colabs = useMemo(() => new Map(dados.colaboradores.map((c) => [c.id, c])), [dados.colaboradores]);
  const { obras } = useMemo(() => avaliarPortfolio(dados, hoje), [dados, hoje]);

  function nova() {
    setEditando({
      id: crypto.randomUUID(),
      nome: "",
      cliente: "",
      local: "",
      data_inicio: hoje,
      data_fim_contratual: null,
      cor: CORES[dados.obras.length % CORES.length],
    });
  }

  if (carregando) return <p className="text-slate-500">Carregando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="titulo-secao">Obras e pipeline</h1>
        <button className="botao" onClick={nova}>+ Nova obra</button>
      </div>

      {editando && (
        <FormObra
          obra={editando}
          onCancelar={() => setEditando(null)}
          onSalvar={async (o) => {
            await repo.salvarObra(o);
            setEditando(null);
          }}
        />
      )}

      {obras.length === 0 && !editando && (
        <div className="cartao text-sm text-slate-500">Nenhuma obra cadastrada.</div>
      )}

      {obras.map(({ plano, nivel, analises }) => (
        <div key={plano.obra.id} className="cartao space-y-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="h-4 w-4 rounded" style={{ background: plano.obra.cor }} />
            <h2 className="text-lg font-semibold">{plano.obra.nome}</h2>
            <span className="text-sm text-slate-500">
              {plano.obra.cliente}
              {plano.obra.local ? ` · ${plano.obra.local}` : ""}
            </span>
            <NivelBadge nivel={nivel} />
            <div className="ml-auto flex gap-1">
              {plano.etapas.length === 0 && (
                <Link className="botao-sec !border-blue-300 !text-blue-700" href={`/movimentar?etapa=obra:${plano.obra.id}`}>
                  + Alocar na obra
                </Link>
              )}
              <button className="botao-sec" onClick={() => setEditando(plano.obra)}>Editar</button>
              <button
                className="botao-perigo"
                onClick={() =>
                  confirm(`Excluir a obra "${plano.obra.nome}" com todas as etapas e alocações?`) &&
                  repo.excluirObra(plano.obra.id)
                }
              >
                Excluir
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Início {fmt(plano.inicio)} · Término previsto <b>{fmt(plano.fimPrevisto)}</b>
            {plano.obra.data_fim_contratual && <> · Contratual {fmt(plano.obra.data_fim_contratual)}</>}
            {plano.folgaDias !== null && (
              <span className={plano.folgaDias < 0 ? "font-semibold text-red-600" : ""}>
                {" "}
                · {plano.folgaDias < 0 ? `Estouro de ${plural(-plano.folgaDias, "dia")}` : `Folga ${plural(plano.folgaDias, "dia")}`}
              </span>
            )}
          </p>

          <Pipeline plano={plano} analises={analises} alocacoes={dados.alocacoes} colaboradores={colabs} hoje={hoje} />

          <TabelaEtapas obraId={plano.obra.id} etapasPlan={plano.etapas} etapas={dados.etapas.filter((e) => e.obra_id === plano.obra.id)} />
        </div>
      ))}
    </div>
  );
}

function FormObra({ obra, onSalvar, onCancelar }: { obra: Obra; onSalvar: (o: Obra) => Promise<void>; onCancelar: () => void }) {
  const [o, setO] = useState(obra);
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof Obra>(k: K, v: Obra[K]) => setO({ ...o, [k]: v });
  return (
    <form
      className="cartao grid gap-3 md:grid-cols-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setSalvando(true);
        try {
          await onSalvar({ ...o, local: o.local || null, data_fim_contratual: o.data_fim_contratual || null });
        } finally {
          setSalvando(false);
        }
      }}
    >
      <label className="md:col-span-2">
        <span className="rotulo">Obra</span>
        <input className="campo" required value={o.nome} onChange={(e) => set("nome", e.target.value)} />
      </label>
      <label className="md:col-span-2">
        <span className="rotulo">Cliente</span>
        <input className="campo" value={o.cliente} onChange={(e) => set("cliente", e.target.value)} />
      </label>
      <label className="md:col-span-2">
        <span className="rotulo">Local</span>
        <input className="campo" value={o.local ?? ""} onChange={(e) => set("local", e.target.value)} />
      </label>
      <label className="md:col-span-2">
        <span className="rotulo">Início</span>
        <input className="campo" type="date" required value={o.data_inicio} onChange={(e) => set("data_inicio", e.target.value)} />
      </label>
      <label className="md:col-span-2">
        <span className="rotulo">Prazo contratual (término)</span>
        <input
          className="campo"
          type="date"
          value={o.data_fim_contratual ?? ""}
          onChange={(e) => set("data_fim_contratual", e.target.value || null)}
        />
      </label>
      <label>
        <span className="rotulo">Cor</span>
        <input className="campo h-[38px] p-1" type="color" value={o.cor} onChange={(e) => set("cor", e.target.value)} />
      </label>
      <div className="flex items-end gap-2">
        <button className="botao" disabled={salvando}>Salvar</button>
        <button type="button" className="botao-sec" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

function TabelaEtapas({
  obraId,
  etapas,
  etapasPlan,
}: {
  obraId: string;
  etapas: Etapa[];
  etapasPlan: { id: string; inicio: string; fim: string }[];
}) {
  const { repo } = useDados();
  const [nova, setNova] = useState(false);
  const ordenadas = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const proximaOrdem = (ordenadas.at(-1)?.ordem ?? 0) + 1;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase text-slate-500">
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">Etapa</th>
            <th className="py-1 pr-2">Duração (d)</th>
            <th className="py-1 pr-2" title="Defasagem após o término da etapa anterior. Negativo = sobreposição.">Defasagem (d)</th>
            <th className="py-1 pr-2">Equipe necessária</th>
            <th className="py-1 pr-2">Período</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((e) => (
            <LinhaEtapa key={e.id} etapa={e} plan={etapasPlan.find((p) => p.id === e.id)} onSalvar={repo.salvarEtapa} onExcluir={repo.excluirEtapa} />
          ))}
          {nova && (
            <LinhaEtapa
              etapa={{ id: crypto.randomUUID(), obra_id: obraId, nome: "", ordem: proximaOrdem, duracao_dias: 10, lag_dias: 0, necessidades: [] }}
              novo
              onSalvar={async (e) => {
                await repo.salvarEtapa(e);
                setNova(false);
              }}
              onExcluir={async () => setNova(false)}
            />
          )}
        </tbody>
      </table>
      {!nova && (
        <button className="botao-sec mt-2" onClick={() => setNova(true)}>+ Etapa</button>
      )}
    </div>
  );
}

function LinhaEtapa({
  etapa,
  plan,
  novo,
  onSalvar,
  onExcluir,
}: {
  etapa: Etapa;
  plan?: { inicio: string; fim: string };
  novo?: boolean;
  onSalvar: (e: Etapa) => Promise<void>;
  onExcluir: (id: string) => Promise<void>;
}) {
  const [edit, setEdit] = useState(!!novo);
  const [e, setE] = useState(etapa);
  const [nec, setNec] = useState(necessidadesParaTexto(etapa.necessidades));

  if (!edit) {
    return (
      <tr className="border-b last:border-0">
        <td className="py-1.5 pr-2 text-slate-400">{etapa.ordem}</td>
        <td className="py-1.5 pr-2 font-medium">{etapa.nome}</td>
        <td className="py-1.5 pr-2">{etapa.duracao_dias}</td>
        <td className="py-1.5 pr-2">{etapa.lag_dias}</td>
        <td className="py-1.5 pr-2">{necessidadesParaTexto(etapa.necessidades) || <span className="text-slate-400">—</span>}</td>
        <td className="whitespace-nowrap py-1.5 pr-2 text-slate-500">{plan ? `${fmt(plan.inicio)} – ${fmt(plan.fim)}` : ""}</td>
        <td className="whitespace-nowrap py-1.5 text-right">
          <Link className="botao-sec mr-1 !border-blue-300 !text-blue-700" href={`/movimentar?etapa=${etapa.id}`} title="Alocar colaborador nesta etapa">
            + Alocar
          </Link>
          <button className="botao-sec" onClick={() => { setE(etapa); setNec(necessidadesParaTexto(etapa.necessidades)); setEdit(true); }}>Editar</button>
          <button className="botao-perigo" onClick={() => confirm(`Excluir a etapa "${etapa.nome}" e suas alocações?`) && onExcluir(etapa.id)}>✕</button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b bg-blue-50/40">
      <td className="py-1 pr-2">
        <input className="campo w-14" type="number" value={e.ordem} onChange={(x) => setE({ ...e, ordem: Number(x.target.value) })} />
      </td>
      <td className="py-1 pr-2">
        <input className="campo min-w-[10rem]" placeholder="Ex.: Alvenaria" value={e.nome} onChange={(x) => setE({ ...e, nome: x.target.value })} />
      </td>
      <td className="py-1 pr-2">
        <input className="campo w-20" type="number" min={1} value={e.duracao_dias} onChange={(x) => setE({ ...e, duracao_dias: Number(x.target.value) })} />
      </td>
      <td className="py-1 pr-2">
        <input className="campo w-20" type="number" value={e.lag_dias} onChange={(x) => setE({ ...e, lag_dias: Number(x.target.value) })} />
      </td>
      <td className="py-1 pr-2" colSpan={2}>
        <input className="campo min-w-[14rem]" placeholder="3 Pedreiro, 2 Servente" value={nec} onChange={(x) => setNec(x.target.value)} />
      </td>
      <td className="whitespace-nowrap py-1 text-right">
        <button
          className="botao"
          disabled={!e.nome.trim() || e.duracao_dias < 1}
          onClick={async () => {
            await onSalvar({ ...e, nome: e.nome.trim(), necessidades: textoParaNecessidades(nec) });
            setEdit(false);
          }}
        >
          Salvar
        </button>
        <button className="botao-perigo" onClick={() => (novo ? onExcluir(e.id) : setEdit(false))}>Cancelar</button>
      </td>
    </tr>
  );
}
