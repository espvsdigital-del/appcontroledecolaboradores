"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useDados } from "@/components/DadosProvider";
import { indexarEtapas, planejarTodas } from "@/lib/cronograma";
import { fmt, hoje as hojeFn } from "@/lib/datas";
import { localizacaoNoDia } from "@/lib/impacto";
import type { Colaborador } from "@/lib/tipos";

export default function PaginaColaboradores() {
  const { dados, repo, carregando } = useDados();
  const hoje = hojeFn();
  const [editando, setEditando] = useState<Colaborador | null>(null);
  const [busca, setBusca] = useState("");
  const local = useMemo(() => localizacaoNoDia(dados, hoje), [dados, hoje]);
  const etapas = useMemo(() => indexarEtapas(planejarTodas(dados)), [dados]);
  const obras = useMemo(() => new Map(dados.obras.map((o) => [o.id, o])), [dados.obras]);

  const funcoes = useMemo(() => {
    const s = new Set<string>();
    dados.colaboradores.forEach((c) => s.add(c.funcao));
    dados.etapas.forEach((e) => e.necessidades.forEach((n) => s.add(n.funcao)));
    return [...s].sort();
  }, [dados]);

  const lista = [...dados.colaboradores]
    .filter((c) => `${c.nome} ${c.funcao}`.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => a.funcao.localeCompare(b.funcao) || a.nome.localeCompare(b.nome));

  function proxima(colabId: string) {
    const a = dados.alocacoes
      .filter((x) => x.colaborador_id === colabId && x.data_inicio > hoje)
      .sort((x, y) => x.data_inicio.localeCompare(y.data_inicio))[0];
    if (!a) return null;
    const e = etapas.get(a.etapa_id);
    return e ? `${fmt(a.data_inicio)} · ${obras.get(e.obra_id)?.nome} › ${e.nome}` : null;
  }

  if (carregando) return <p className="text-slate-500">Carregando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="titulo-secao">Colaboradores</h1>
        <input className="campo !mt-0 max-w-xs" placeholder="Buscar nome ou função…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button
          className="botao ml-auto"
          onClick={() => setEditando({ id: crypto.randomUUID(), nome: "", funcao: "", telefone: null, ativo: true })}
        >
          + Novo colaborador
        </button>
      </div>

      {editando && (
        <form
          className="cartao grid gap-3 md:grid-cols-5"
          onSubmit={async (e) => {
            e.preventDefault();
            await repo.salvarColaborador({ ...editando, nome: editando.nome.trim(), funcao: editando.funcao.trim(), telefone: editando.telefone || null });
            setEditando(null);
          }}
        >
          <label className="md:col-span-2">
            <span className="rotulo">Nome</span>
            <input className="campo" required value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
          </label>
          <label>
            <span className="rotulo">Função</span>
            <input className="campo" required list="funcoes" value={editando.funcao} onChange={(e) => setEditando({ ...editando, funcao: e.target.value })} />
            <datalist id="funcoes">
              {funcoes.map((f) => <option key={f} value={f} />)}
            </datalist>
          </label>
          <label>
            <span className="rotulo">Telefone</span>
            <input className="campo" value={editando.telefone ?? ""} onChange={(e) => setEditando({ ...editando, telefone: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={editando.ativo} onChange={(e) => setEditando({ ...editando, ativo: e.target.checked })} />
            Ativo
          </label>
          <div className="flex gap-2 md:col-span-5">
            <button className="botao">Salvar</button>
            <button type="button" className="botao-sec" onClick={() => setEditando(null)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="cartao overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Função</th>
              <th className="px-4 py-2">Onde está hoje</th>
              <th className="px-4 py-2">Próxima alocação</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => {
              const l = local.get(c.id);
              return (
                <tr key={c.id} className={`border-b last:border-0 ${c.ativo ? "" : "opacity-50"}`}>
                  <td className="px-4 py-2 font-medium">
                    {c.nome}
                    {!c.ativo && <span className="ml-2 text-xs text-slate-500">(inativo)</span>}
                    {c.telefone && <div className="text-xs text-slate-500">{c.telefone}</div>}
                  </td>
                  <td className="px-4 py-2">{c.funcao}</td>
                  <td className="px-4 py-2">
                    {l ? (
                      <span>
                        <b>{l.obraNome}</b> › {l.etapa.nome}
                        <span className="text-xs text-slate-500"> até {fmt(l.alocacao.data_fim)}</span>
                      </span>
                    ) : (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Disponível</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{proxima(c.id) ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <Link className="botao-sec" href={`/movimentar?colaborador=${c.id}`}>Mover</Link>{" "}
                    <button className="botao-sec" onClick={() => setEditando(c)}>Editar</button>
                    <button
                      className="botao-perigo"
                      onClick={() => confirm(`Excluir ${c.nome} e suas alocações?`) && repo.excluirColaborador(c.id)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">Nenhum colaborador.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
