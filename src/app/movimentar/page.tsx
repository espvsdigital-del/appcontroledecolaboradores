"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDados } from "@/components/DadosProvider";
import { CaixaAlerta, ESTILO_NIVEL, NivelBadge } from "@/components/Nivel";
import { indexarEtapas, planejarTodas } from "@/lib/cronograma";
import { diffDias, fmt, hoje as hojeFn, maxData } from "@/lib/datas";
import { simularMovimento } from "@/lib/impacto";
import type { Etapa } from "@/lib/tipos";

const LIBERAR = "__liberar__";
/** Destino "obra sem etapas": cria automaticamente a etapa "Execução geral" ao confirmar. */
const OBRA = "obra:";
const DURACAO_PADRAO = 90;

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
  const [destino, setDestino] = useState(params.get("etapa") ?? "");
  const [inicio, setInicio] = useState(hoje);
  const [fim, setFim] = useState(hoje);
  const [motivo, setMotivo] = useState("");
  const [ciente, setCiente] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [feito, setFeito] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Alocação direta na obra (sem etapas): simula com uma etapa provisória que cobre a obra inteira.
  const etapaGeral = useMemo<Etapa | null>(() => {
    if (!destino.startsWith(OBRA)) return null;
    const obra = dados.obras.find((o) => o.id === destino.slice(OBRA.length));
    if (!obra) return null;
    const prazo = obra.data_fim_contratual ? diffDias(obra.data_inicio, obra.data_fim_contratual) + 1 : 0;
    return {
      id: crypto.randomUUID(),
      obra_id: obra.id,
      nome: "Execução geral",
      ordem: 1,
      duracao_dias: prazo > 0 ? prazo : DURACAO_PADRAO,
      lag_dias: 0,
      necessidades: [],
    };
  }, [destino, dados.obras]);
  const dadosSim = useMemo(
    () => (etapaGeral ? { ...dados, etapas: [...dados.etapas, etapaGeral] } : dados),
    [dados, etapaGeral],
  );
  const etapaDestinoId = destino === LIBERAR ? null : etapaGeral?.id ?? destino;

  const planosReais = useMemo(() => planejarTodas(dados), [dados]);
  const planos = useMemo(() => planejarTodas(dadosSim), [dadosSim]);
  const etapas = useMemo(() => indexarEtapas(planos), [planos]);
  const colab = dados.colaboradores.find((c) => c.id === colabId);

  // Ao escolher a etapa de destino, sugere o período de hoje (ou início da etapa) até o fim da etapa.
  // Aplica uma vez por destino (inclusive quando ele vem da URL e os dados ainda estão carregando).
  const periodoSugerido = useRef("");
  const destinoPlan = etapaDestinoId ? etapas.get(etapaDestinoId) : undefined;
  useEffect(() => {
    if (!destinoPlan || periodoSugerido.current === destino) return;
    periodoSugerido.current = destino;
    setInicio(maxData(hoje, destinoPlan.inicio));
    setFim(maxData(destinoPlan.fim, maxData(hoje, destinoPlan.inicio)));
  }, [destino, destinoPlan, hoje]);

  useEffect(() => setCiente(false), [colabId, destino, inicio, fim]);

  const valido = !!colab && !!destino && !!inicio && !!fim;
  const resultado = useMemo(
    () =>
      valido
        ? simularMovimento(
            dadosSim,
            { colaborador_id: colabId, etapa_id: etapaDestinoId, data_inicio: inicio, data_fim: fim },
            hoje,
          )
        : null,
    [dadosSim, valido, colabId, etapaDestinoId, inicio, fim, hoje],
  );

  const agenda = dados.alocacoes
    .filter((a) => a.colaborador_id === colabId && a.data_fim >= hoje)
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));

  const bloqueado = !resultado || fim < inicio || (resultado.nivel === "critico" && !ciente);
  const pendencias = [
    !colab && "escolha o colaborador",
    !destino && "escolha o destino (obra ou etapa)",
    fim < inicio && "o término do período deve ser igual ou posterior ao início",
    resultado?.nivel === "critico" && !ciente && "marque \"Estou ciente\" para confirmar um impacto crítico",
  ].filter(Boolean) as string[];
  const obrasSemEtapas = [...planosReais.values()].filter((p) => p.etapas.length === 0);

  async function confirmar() {
    if (!resultado || !colab) return;
    setSalvando(true);
    setErro(null);
    try {
      if (etapaGeral) await repo.salvarEtapa(etapaGeral);
      await repo.moverColaborador({
        colaborador_id: colabId,
        etapa_id: etapaDestinoId,
        data_inicio: inicio,
        data_fim: fim,
        motivo,
        nivel: resultado.nivel,
        resumo: resultado.resumo,
      });
      setFeito(`${colab.nome} alocado(a) com sucesso. ${resultado.resumo}`);
      setDestino("");
      setMotivo("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErro(
        /mover_colaborador|function/i.test(msg)
          ? `${msg} — verifique se o script supabase/migrations/0001_init.sql foi executado no Supabase.`
          : msg,
      );
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <p className="text-slate-500">Carregando…</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <section className="cartao space-y-4 lg:col-span-2">
        <h1 className="titulo-secao">Alocar / movimentar colaborador</h1>
        <p className="-mt-2 text-sm text-slate-500">
          Use esta tela tanto para a <b>primeira alocação</b> quanto para remanejar alguém.{" "}
          <Link href="/tutorial" className="text-blue-700 underline">Ver tutorial</Link>
        </p>
        {dados.colaboradores.length === 0 && (
          <Aviso>
            Nenhum colaborador cadastrado. <Link className="underline" href="/colaboradores">Cadastre em Colaboradores</Link>.
          </Aviso>
        )}
        {dados.obras.length === 0 && (
          <Aviso>
            Nenhuma obra cadastrada. <Link className="underline" href="/obras">Cadastre em Obras e pipeline</Link>.
          </Aviso>
        )}

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
            {obrasSemEtapas.length > 0 && (
              <optgroup label="Obras (alocação direta)">
                {obrasSemEtapas.map((p) => (
                  <option key={p.obra.id} value={OBRA + p.obra.id}>
                    {p.obra.nome}
                    {p.obra.cliente ? ` (${p.obra.cliente})` : ""}
                  </option>
                ))}
              </optgroup>
            )}
            {[...planosReais.values()].filter((p) => p.etapas.length > 0).map((p) => (
              <optgroup key={p.obra.id} label={`${p.obra.nome} (${p.obra.cliente})`}>
                {p.etapas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome} · {fmt(e.inicio)} a {fmt(e.fim)}
                    {e.fim < hoje ? " (concluída)" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {etapaGeral && destinoPlan && (
          <p className="rounded-md bg-blue-50 p-2 text-xs text-blue-900">
            Esta obra ainda não tem etapas: ao confirmar, será criada a etapa <b>&quot;Execução geral&quot;</b> (
            {fmt(destinoPlan.inicio)} a {fmt(destinoPlan.fim)}). Depois você pode detalhar o pipeline e a equipe
            necessária em <Link className="underline" href="/obras">Obras e pipeline</Link> para ativar a análise de impacto.
          </p>
        )}

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

        {pendencias.length > 0 && (
          <p className="text-xs text-slate-500">Para confirmar: {pendencias.join("; ")}.</p>
        )}
        <button className="botao w-full" disabled={bloqueado || salvando} onClick={confirmar}>
          {salvando ? "Salvando…" : "Confirmar alocação"}
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

function Aviso({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">{children}</p>;
}
