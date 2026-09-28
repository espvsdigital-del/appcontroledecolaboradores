"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDados } from "@/components/DadosProvider";
import { CaixaAlerta, ESTILO_NIVEL, NivelBadge } from "@/components/Nivel";
import { indexarEtapas, planejarTodas } from "@/lib/cronograma";
import { fmt, hoje as hojeFn, maxData } from "@/lib/datas";
import { simularMovimento } from "@/lib/impacto";

const LIBERAR = "__liberar__";

export default function PaginaMovimentar() {
  return (
    <Suspense fallback={<p className="text-slate-500">Carregando…</p>}>
      <Movimentar />
    </Suspense>
  );
}

function Movimentar() {
  const { dados, repo, carregando } = useDados();
  const params = useSearchParams();
  const hoje = hojeFn();

  const [colabId, setColabId] = useState(params.get("colaborador") ?? "");
  const [destino, setDestino] = useState("");
  const [inicio, setInicio] = useState(hoje);
  const [fim, setFim] = useState(hoje);
  const [motivo, setMotivo] = useState("");
  const [ciente, setCiente] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [feito, setFeito] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const planos = useMemo(() => planejarTodas(dados), [dados]);
  const etapas = useMemo(() => indexarEtapas(planos), [planos]);
  const colab = dados.colaboradores.find((c) => c.id === colabId);

  // Ao escolher a etapa de destino, sugere o período de hoje (ou início da etapa) até o fim da etapa.
  useEffect(() => {
    const e = etapas.get(destino);
    if (!e) return;
    setInicio(maxData(hoje, e.inicio));
    setFim(maxData(e.fim, maxData(hoje, e.inicio)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destino]);

  useEffect(() => setCiente(false), [colabId, destino, inicio, fim]);

  const valido = !!colab && !!destino && !!inicio && !!fim;
  const resultado = useMemo(
    () =>
      valido
        ? simularMovimento(
            dados,
            { colaborador_id: colabId, etapa_id: destino === LIBERAR ? null : destino, data_inicio: inicio, data_fim: fim },
            hoje,
          )
        : null,
    [dados, valido, colabId, destino, inicio, fim, hoje],
  );

  const agenda = dados.alocacoes
    .filter((a) => a.colaborador_id === colabId && a.data_fim >= hoje)
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));

  const bloqueado = !resultado || fim < inicio || (resultado.nivel === "critico" && !ciente);

  async function confirmar() {
    if (!resultado || !colab) return;
    setSalvando(true);
    setErro(null);
    try {
      await repo.moverColaborador({
        colaborador_id: colabId,
        etapa_id: destino === LIBERAR ? null : destino,
        data_inicio: inicio,
        data_fim: fim,
        motivo,
        nivel: resultado.nivel,
        resumo: resultado.resumo,
      });
      setFeito(`${colab.nome} movimentado(a). ${resultado.resumo}`);
      setDestino("");
      setMotivo("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <p className="text-slate-500">Carregando…</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <section className="cartao space-y-4 lg:col-span-2">
        <h1 className="titulo-secao">Movimentar colaborador</h1>

        <label className="block">
          <span className="rotulo">Colaborador</span>
          <select className="campo" value={colabId} onChange={(e) => setColabId(e.target.value)}>
            <option value="">Selecione…</option>
            {[...dados.colaboradores]
              .sort((a, b) => a.nome.localeCompare(b.nome))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} — {c.funcao}
                  {c.ativo ? "" : " (inativo)"}
                </option>
              ))}
          </select>
        </label>

        {colab && (
          <div className="rounded-md bg-slate-50 p-3 text-sm">
            <p className="rotulo mb-1">Agenda atual</p>
            {agenda.length === 0 ? (
              <p className="text-slate-500">Sem alocações futuras — disponível.</p>
            ) : (
              <ul className="space-y-0.5">
                {agenda.map((a) => {
                  const e = etapas.get(a.etapa_id);
                  const o = e && planos.get(e.obra_id)?.obra;
                  return (
                    <li key={a.id} className="flex gap-2">
                      <span className="text-slate-500">
                        {fmt(a.data_inicio)} – {fmt(a.data_fim)}
                      </span>
                      <span className="font-medium">
                        {o?.nome} › {e?.nome}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <label className="block">
          <span className="rotulo">Destino</span>
          <select className="campo" value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="">Selecione…</option>
            <option value={LIBERAR}>— Liberar / afastar (férias, atestado, folga) —</option>
            {[...planos.values()].map((p) => (
              <optgroup key={p.obra.id} label={`${p.obra.nome} (${p.obra.cliente})`}>
                {p.etapas.map((e) => (
                  <option key={e.id} value={e.id} disabled={e.fim < hoje}>
                    {e.nome} · {fmt(e.inicio)} a {fmt(e.fim)}
                    {e.fim < hoje ? " (concluída)" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="rotulo">De</span>
            <input className="campo" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <label className="block">
            <span className="rotulo">Até</span>
            <input className="campo" type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} />
          </label>
        </div>

        <label className="block">
          <span className="rotulo">Motivo / demanda</span>
          <input
            className="campo"
            placeholder="Ex.: urgência de concretagem, pedido do cliente…"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </label>

        {resultado?.nivel === "critico" && (
          <label className="flex items-start gap-2 text-sm text-red-700">
            <input type="checkbox" className="mt-0.5" checked={ciente} onChange={(e) => setCiente(e.target.checked)} />
            Estou ciente do impacto crítico e quero confirmar mesmo assim.
          </label>
        )}

        <button className="botao w-full" disabled={bloqueado || salvando} onClick={confirmar}>
          {salvando ? "Salvando…" : "Confirmar movimentação"}
        </button>
        {feito && <p className="rounded-md bg-green-50 p-2 text-sm text-green-800">{feito}</p>}
        {erro && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{erro}</p>}
      </section>

      <section className="space-y-3 lg:col-span-3">
        <h2 className="titulo-secao">Análise de impacto</h2>
        {!resultado ? (
          <div className="cartao text-sm text-slate-500">
            Escolha o colaborador, o destino e o período. O impacto nas obras, clientes e etapas é calculado na hora.
          </div>
        ) : (
          <>
            <div className={`rounded-xl border-2 p-4 ${ESTILO_NIVEL[resultado.nivel].caixa}`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl" aria-hidden>
                  {resultado.nivel === "ok" ? "✅" : resultado.nivel === "atencao" ? "⚠️" : "⛔"}
                </span>
                <div>
                  <NivelBadge nivel={resultado.nivel} />
                  <p className="mt-1 font-semibold text-slate-800">{resultado.resumo}</p>
                </div>
              </div>
            </div>
            {resultado.itens.map((i, k) => (
              <CaixaAlerta key={k} nivel={i.nivel} titulo={i.titulo} detalhes={i.detalhes} />
            ))}
            <p className="text-xs text-slate-500">
              Premissas: dias corridos; produção da etapa proporcional à equipe da função-gargalo; etapas encadeadas
              término-início com defasagem. O atraso da etapa desloca as subsequentes da mesma obra.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
