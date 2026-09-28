"use client";

import type { ObraPlanejada } from "@/lib/cronograma";
import { diffDias, fmt, fmtCurto, maxData, minData } from "@/lib/datas";
import { equipeNoDia, type AnaliseEtapa } from "@/lib/impacto";
import type { Alocacao, Colaborador } from "@/lib/tipos";

/** Gantt simplificado do pipeline da obra, com cobertura de equipe por etapa. */
export default function Pipeline({
  plano,
  analises,
  alocacoes,
  colaboradores,
  hoje,
}: {
  plano: ObraPlanejada;
  analises: Map<string, AnaliseEtapa>;
  alocacoes: Alocacao[];
  colaboradores: Map<string, Colaborador>;
  hoje: string;
}) {
  if (!plano.etapas.length) {
    return <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
        Nenhuma etapa cadastrada. Em <b>Obras e pipeline</b>, clique em <b>+ Etapa</b> para montar o pipeline — sem
        etapas não é possível alocar colaboradores nesta obra.
      </p>;
  }
  const ini = minData(plano.inicio, hoje);
  const fim = maxData(plano.fimPrevisto, plano.obra.data_fim_contratual ?? plano.fimPrevisto);
  const total = Math.max(1, diffDias(ini, fim) + 1);
  const pos = (d: string) => (diffDias(ini, d) / total) * 100;
  const larg = (a: string, b: string) => ((diffDias(a, b) + 1) / total) * 100;
  const mostrarHoje = hoje >= ini && hoje <= fim;

  return (
    <div className="space-y-1.5">
      <div className="relative ml-40 h-4 text-[10px] text-slate-400">
        <span className="absolute left-0">{fmtCurto(ini)}</span>
        <span className="absolute right-0">{fmtCurto(fim)}</span>
      </div>
      {plano.etapas.map((e) => {
        const an = analises.get(e.id);
        const deficit = !!an && an.faltas.length > 0;
        const noDia = equipeNoDia(e, alocacoes, colaboradores, maxData(minData(hoje, e.fim), e.inicio));
        const concluida = e.fim < hoje;
        return (
          <div key={e.id} className="flex items-center gap-2">
            <div className="w-[9.5rem] shrink-0 truncate text-sm text-slate-700" title={e.nome}>
              {e.nome}
            </div>
            <div className="relative h-7 flex-1 rounded bg-slate-100">
              {mostrarHoje && (
                <div className="absolute inset-y-0 z-10 w-px bg-slate-800/60" style={{ left: `${pos(hoje)}%` }} />
              )}
              {plano.obra.data_fim_contratual && (
                <div
                  className="absolute inset-y-0 z-10 w-px border-l-2 border-dashed border-red-500"
                  style={{ left: `${pos(plano.obra.data_fim_contratual) + larg(plano.obra.data_fim_contratual, plano.obra.data_fim_contratual)}%` }}
                />
              )}
              <div
                className={`absolute inset-y-0.5 flex items-center overflow-hidden rounded px-1.5 text-[11px] font-medium text-white ${
                  concluida ? "opacity-40" : ""
                } ${deficit ? "ring-2 ring-amber-400" : ""}`}
                style={{
                  left: `${pos(e.inicio)}%`,
                  width: `${larg(e.inicio, e.fim)}%`,
                  background: deficit ? "#d97706" : plano.obra.cor,
                }}
                title={`${e.nome}: ${fmt(e.inicio)} a ${fmt(e.fim)} (${e.duracao_dias}d)${
                  deficit ? "\nEquipe incompleta: " + an!.faltas.map((f) => `-${f.maxFalta} ${f.funcao}`).join(", ") : ""
                }`}
              >
                <span className="truncate">
                  {noDia.necessario > 0 ? `${noDia.presentes}/${noDia.necessario}` : ""}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      <div className="ml-40 flex flex-wrap gap-4 pt-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="h-3 w-px bg-slate-800" /> hoje</span>
        {plano.obra.data_fim_contratual && (
          <span className="flex items-center gap-1"><span className="h-3 border-l-2 border-dashed border-red-500" /> prazo contratual</span>
        )}
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded bg-amber-600" /> equipe incompleta</span>
        <span>n/m = alocados/necessários (hoje ou início da etapa)</span>
      </div>
    </div>
  );
}
