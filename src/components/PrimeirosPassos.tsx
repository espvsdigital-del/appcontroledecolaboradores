"use client";

import Link from "next/link";
import type { Dados } from "@/lib/tipos";

/** Checklist de implantação exibido no Painel enquanto o cadastro base está incompleto. */
export default function PrimeirosPassos({ dados }: { dados: Dados }) {
  const obrasSemEtapa = dados.obras.filter((o) => !dados.etapas.some((e) => e.obra_id === o.id));
  const passos = [
    { feito: dados.obras.length > 0, texto: "Cadastrar uma obra", href: "/obras", acao: "+ Nova obra" },
    {
      feito: dados.obras.length > 0 && obrasSemEtapa.length === 0,
      texto: "Cadastrar as etapas (pipeline) de cada obra, com a equipe necessária",
      detalhe: obrasSemEtapa.length ? `Sem etapas: ${obrasSemEtapa.map((o) => o.nome).join(", ")}` : undefined,
      href: "/obras",
      acao: "+ Etapa",
    },
    { feito: dados.colaboradores.length > 0, texto: "Cadastrar os colaboradores", href: "/colaboradores", acao: "+ Novo colaborador" },
    { feito: dados.alocacoes.length > 0, texto: "Alocar cada colaborador numa obra/etapa", href: "/movimentar", acao: "Alocar / movimentar" },
  ];
  if (passos.every((p) => p.feito)) return null;

  return (
    <section className="cartao border-blue-200 bg-blue-50/50">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="titulo-secao">Primeiros passos</h2>
        <Link href="/tutorial" className="text-sm text-blue-700 underline">Ver tutorial completo</Link>
      </div>
      <ol className="space-y-2">
        {passos.map((p, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                p.feito ? "bg-green-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-300"
              }`}
            >
              {p.feito ? "✓" : i + 1}
            </span>
            <span className={p.feito ? "text-slate-400 line-through" : "font-medium"}>{p.texto}</span>
            {!p.feito && (
              <Link href={p.href} className="botao-sec !py-0.5 text-xs">
                {p.acao}
              </Link>
            )}
            {!p.feito && p.detalhe && <span className="w-full pl-8 text-xs text-amber-700">{p.detalhe}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
