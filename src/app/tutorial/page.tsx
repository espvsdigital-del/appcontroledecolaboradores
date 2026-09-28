import Link from "next/link";

const PASSOS: { titulo: string; tela: string; href: string; itens: string[] }[] = [
  {
    titulo: "Cadastre a obra",
    tela: "Obras e pipeline → + Nova obra",
    href: "/obras",
    itens: [
      "Informe nome, cliente, local e data de início.",
      "Preencha o prazo contratual (término): é ele que define quando um remanejamento vira CRÍTICO.",
      "Clique em Salvar.",
    ],
  },
  {
    titulo: "Monte o pipeline (etapas)",
    tela: "Obras e pipeline → + Etapa (abaixo do gráfico da obra)",
    href: "/obras",
    itens: [
      "Cadastre as etapas na ordem de execução (#1, #2, #3…).",
      "Duração em dias corridos.",
      "Defasagem: 0 = começa no dia seguinte ao fim da anterior; negativo = sobreposição (ex.: -10 começa 10 dias antes).",
      "Equipe necessária no formato \"3 Pedreiro, 2 Servente\".",
      "Atalho: dá para alocar direto numa obra sem etapas — o app cria a etapa \"Execução geral\". Mas, sem a equipe necessária por etapa, não há análise de falta/atraso.",
    ],
  },
  {
    titulo: "Cadastre os colaboradores",
    tela: "Colaboradores → + Novo colaborador",
    href: "/colaboradores",
    itens: [
      "Nome e função.",
      "A função deve ter o MESMO nome usado nas etapas (\"Pedreiro\" ≠ \"Oficial pedreiro\"). O campo sugere as funções já usadas.",
    ],
  },
  {
    titulo: "Aloque cada colaborador",
    tela: "Alocar / movimentar  —  ou botão \"+ Alocar\" na linha da etapa",
    href: "/movimentar",
    itens: [
      "Escolha o colaborador e a etapa de destino (as etapas aparecem agrupadas por obra).",
      "O período é sugerido automaticamente (de hoje até o fim da etapa); ajuste se precisar.",
      "Informe o motivo (opcional) e clique em Confirmar alocação.",
      "Se o botão estiver cinza, a tela mostra logo acima o que falta preencher.",
    ],
  },
  {
    titulo: "Remaneje e leia o alerta",
    tela: "Alocar / movimentar",
    href: "/movimentar",
    itens: [
      "Ao escolher um novo destino para alguém já alocado, a análise aparece na hora, antes de confirmar.",
      "✅ OK: sem impacto.  ⚠️ Atenção: atrasa etapa / consome folga / destino excedente.  ⛔ Crítico: estoura o prazo contratual.",
      "Para confirmar um Crítico é preciso marcar \"Estou ciente\". Tudo fica registrado no Histórico.",
      "Férias, atestado ou folga: destino \"Liberar / afastar\".",
    ],
  },
];

const PROBLEMAS: [string, string][] = [
  ["A análise não mostra falta nem atraso", "A etapa não tem \"Equipe necessária\" preenchida (ex.: \"2 Pedreiro, 1 Servente\"). Edite a etapa em Obras e pipeline."],
  ["O botão \"Confirmar alocação\" está cinza", "Falta colaborador ou destino, o período está invertido, ou o impacto é Crítico e falta marcar \"Estou ciente\"."],
  ["Alocado, mas a etapa continua \"equipe incompleta\"", "A função do colaborador não bate com a da etapa, ou o período não cobre a etapa inteira."],
  ["Erro mencionando \"mover_colaborador\"", "O script SQL não foi executado no Supabase. Rode supabase/migrations/0001_init.sql no SQL Editor."],
  ["Nada aparece / dados sumiram", "Confira se entrou com o mesmo e-mail: cada conta enxerga apenas os próprios dados."],
];

export default function Tutorial() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tutorial</h1>
        <p className="text-slate-600">Da obra cadastrada ao alerta de impacto, em 5 passos.</p>
      </div>

      <ol className="space-y-3">
        {PASSOS.map((p, i) => (
          <li key={i} className="cartao">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
                {i + 1}
              </span>
              <div className="flex-1">
                <h2 className="font-semibold">{p.titulo}</h2>
                <Link href={p.href} className="text-sm text-blue-700 underline">{p.tela}</Link>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {p.itens.map((t, k) => <li key={k}>{t}</li>)}
                </ul>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <section className="cartao">
        <h2 className="titulo-secao mb-2">Problemas comuns</h2>
        <table className="w-full text-sm">
          <tbody>
            {PROBLEMAS.map(([sintoma, solucao]) => (
              <tr key={sintoma} className="border-b align-top last:border-0">
                <td className="w-2/5 py-2 pr-3 font-medium">{sintoma}</td>
                <td className="py-2 text-slate-700">{solucao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="cartao text-sm text-slate-600">
        <h2 className="titulo-secao mb-2">Premissas de cálculo</h2>
        Dias corridos · etapas encadeadas término-início com defasagem · produção da etapa proporcional à equipe da
        função-gargalo · o atraso de uma etapa desloca as subsequentes da mesma obra. Ferramenta de decisão rápida de
        remanejamento; não substitui o cronograma executivo nem a linha de base.
      </section>
    </div>
  );
}
