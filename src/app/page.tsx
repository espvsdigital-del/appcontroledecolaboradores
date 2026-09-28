"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useDados } from "@/components/DadosProvider";
import { CaixaAlerta, NivelBadge } from "@/components/Nivel";
import Pipeline from "@/components/Pipeline";
import { fmt, hoje as hojeFn, plural } from "@/lib/datas";
import { avaliarPortfolio, localizacaoNoDia } from "@/lib/impacto";

export default function Painel() {
  const { dados, carregando } = useDados();
  const hoje = hojeFn();
  const colabs = useMemo(() => new Map(dados.colaboradores.map((c) => [c.id, c])), [dados.colaboradores]);
  const { obras, alertas } = useMemo(() => avaliarPortfolio(dados, hoje), [dados, hoje]);
  const local = useMemo(() => localizacaoNoDia(dados, hoje), [dados, hoje]);

  if (carregando) return <p className="text-slate-500">Carregando…</p>;

  const ativos = dados.colaboradores.filter((c) => c.ativo);
  const alocadosHoje = ativos.filter((c) => local.get(c.id));
  const disponiveis = ativos.filter((c) => !local.get(c.id));
  const obrasEmAndamento = obras.filter((o) => o.plano.fimPrevisto >= hoje);

  // Agrupa quem está onde hoje: obra → etapa → colaboradores
  const grupos = new Map<string, { obra: string; cor: string; etapas: Map<string, string[]> }>();
  for (const c of alocadosHoje) {
    const l = local.get(c.id)!;
    const obra = dados.obras.find((o) => o.id === l.etapa.obra_id)!;
    const g = grupos.get(obra.id) ?? { obra: obra.nome, cor: obra.cor, etapas: new Map() };
    const lista = g.etapas.get(l.etapa.nome) ?? [];
    lista.push(c.id);
    g.etapas.set(l.etapa.nome, lista);
    grupos.set(obra.id, g);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi rotulo="Obras em andamento" valor={obrasEmAndamento.length} />
        <Kpi rotulo="Colaboradores ativos" valor={ativos.length} />
        <Kpi rotulo="Alocados hoje" valor={alocadosHoje.length} />
        <Kpi rotulo="Disponíveis hoje" valor={disponiveis.length} />
        <Kpi
          rotulo="Alertas"
          valor={alertas.length}
          destaque={alertas.some((a) => a.nivel === "critico") ? "text-red-600" : alertas.length ? "text-amber-600" : "text-green-600"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="cartao lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="titulo-secao">Onde está cada um hoje · {fmt(hoje)}</h2>
            <Link href="/movimentar" className="botao">Movimentar colaborador</Link>
          </div>
          {!grupos.size && !disponiveis.length && (
            <p className="text-sm text-slate-500">
              Cadastre <Link className="text-blue-700 underline" href="/obras">obras</Link> e{" "}
              <Link className="text-blue-700 underline" href="/colaboradores">colaboradores</Link> para começar.
            </p>
          )}
          <div className="space-y-4">
            {[...grupos.entries()].map(([obraId, g]) => (
              <div key={obraId}>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <span className="h-3 w-3 rounded-sm" style={{ background: g.cor }} /> {g.obra}
                </h3>
                <div className="mt-1 space-y-1 pl-5">
                  {[...g.etapas.entries()].map(([etapa, ids]) => (
                    <div key={etapa} className="flex flex-wrap items-baseline gap-1.5 text-sm">
                      <span className="w-40 shrink-0 text-slate-500">{etapa}</span>
                      {ids.map((id) => (
                        <ChipColab key={id} id={id} nome={colabs.get(id)!.nome} funcao={colabs.get(id)!.funcao} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {disponiveis.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Disponíveis (sem alocação hoje)</h3>
                <div className="mt-1 flex flex-wrap gap-1.5 pl-5">
                  {disponiveis.map((c) => (
                    <ChipColab key={c.id} id={c.id} nome={c.nome} funcao={c.funcao} livre />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="cartao lg:col-span-2">
          <h2 className="titulo-secao mb-3">Alertas do portfólio</h2>
          {alertas.length === 0 ? (
            <CaixaAlerta nivel="ok" titulo="Todas as etapas com equipe completa" detalhes={[]} />
          ) : (
            <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
              {alertas.map((a, i) => (
                <CaixaAlerta key={i} nivel={a.nivel} titulo={a.titulo} detalhes={a.detalhes} />
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="titulo-secao">Pipelines</h2>
        {obras.map((o) => (
          <div key={o.plano.obra.id} className="cartao">
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className="font-semibold">{o.plano.obra.nome}</h3>
              <span className="text-sm text-slate-500">{o.plano.obra.cliente}</span>
              <NivelBadge nivel={o.nivel} />
              <span className="ml-auto text-xs text-slate-500">
                Previsto {fmt(o.plano.fimPrevisto)}
                {o.plano.obra.data_fim_contratual && <> · Contratual {fmt(o.plano.obra.data_fim_contratual)}</>}
                {o.plano.folgaDias !== null && (
                  <> · Folga {plural(o.plano.folgaDias, "dia")}</>
                )}
                {o.riscoAtrasoDias > 0 && (
                  <span className="font-medium text-amber-700"> · Risco de atraso por equipe: +{plural(o.riscoAtrasoDias, "dia")}</span>
                )}
              </span>
            </div>
            <Pipeline plano={o.plano} analises={o.analises} alocacoes={dados.alocacoes} colaboradores={colabs} hoje={hoje} />
          </div>
        ))}
      </section>
    </div>
  );
}

function Kpi({ rotulo, valor, destaque = "text-slate-900" }: { rotulo: string; valor: number; destaque?: string }) {
  return (
    <div className="cartao">
      <p className="rotulo">{rotulo}</p>
      <p className={`mt-1 text-2xl font-bold ${destaque}`}>{valor}</p>
    </div>
  );
}

function ChipColab({ id, nome, funcao, livre }: { id: string; nome: string; funcao: string; livre?: boolean }) {
  return (
    <Link
      href={`/movimentar?colaborador=${id}`}
      title={`${funcao} — clique para movimentar`}
      className={`rounded-full border px-2 py-0.5 text-xs hover:border-blue-400 hover:bg-blue-50 ${
        livre ? "border-green-300 bg-green-50 text-green-800" : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      {nome} <span className="text-slate-400">· {funcao}</span>
    </Link>
  );
}
