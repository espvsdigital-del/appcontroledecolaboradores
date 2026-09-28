"use client";

import { useMemo } from "react";
import { useDados } from "@/components/DadosProvider";
import { NivelBadge } from "@/components/Nivel";
import { indexarEtapas, planejarTodas } from "@/lib/cronograma";
import { fmt } from "@/lib/datas";

export default function PaginaHistorico() {
  const { dados, carregando } = useDados();
  const etapas = useMemo(() => indexarEtapas(planejarTodas(dados)), [dados]);
  const obras = useMemo(() => new Map(dados.obras.map((o) => [o.id, o])), [dados.obras]);
  const colabs = useMemo(() => new Map(dados.colaboradores.map((c) => [c.id, c])), [dados.colaboradores]);

  if (carregando) return <p className="text-slate-500">Carregando…</p>;

  return (
    <div className="space-y-4">
      <h1 className="titulo-secao">Histórico de movimentações</h1>
      <div className="cartao overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-2">Quando</th>
              <th className="px-4 py-2">Colaborador</th>
              <th className="px-4 py-2">Destino</th>
              <th className="px-4 py-2">Período</th>
              <th className="px-4 py-2">Motivo</th>
              <th className="px-4 py-2">Impacto registrado</th>
            </tr>
          </thead>
          <tbody>
            {dados.movimentacoes.map((m) => {
              const e = m.etapa_id ? etapas.get(m.etapa_id) : undefined;
              return (
                <tr key={m.id} className="border-b align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">{new Date(m.created_at).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-2 font-medium">{(m.colaborador_id && colabs.get(m.colaborador_id)?.nome) ?? "—"}</td>
                  <td className="px-4 py-2">
                    {m.etapa_id ? (e ? `${obras.get(e.obra_id)?.nome} › ${e.nome}` : "(etapa excluída)") : "Liberado / afastado"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">{fmt(m.data_inicio)} – {fmt(m.data_fim)}</td>
                  <td className="px-4 py-2">{m.motivo || "—"}</td>
                  <td className="px-4 py-2">
                    <NivelBadge nivel={m.nivel} />
                    <p className="mt-1 text-xs text-slate-600">{m.resumo}</p>
                  </td>
                </tr>
              );
            })}
            {dados.movimentacoes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">Nenhuma movimentação registrada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
