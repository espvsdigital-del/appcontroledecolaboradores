# Mapa de Equipes

Controle de **onde estão as equipes de obra** e de **como cada remanejamento afeta as outras obras, clientes e etapas** — em tempo real.

Não é app de apontamento (sem fotos, diário ou tarefas). O foco é alocação:

1. **Obras** → dados base (cliente, local, início, prazo contratual).
2. **Pipeline** → etapas em sequência com duração, defasagem e equipe necessária por função.
3. **Colaboradores** → nome e função.
4. **Movimentar** → ao remanejar o colaborador "X", o app mostra na hora:
   - ✅ **OK**: sem impacto negativo;
   - ⚠️ **Atenção**: atrasa uma etapa / consome folga, destino excedente, etc.;
   - ⛔ **Crítico**: "irá atrapalhar a obra tal (cliente tal)", com a etapa, a função que falta, o período, o atraso estimado, as etapas deslocadas, o novo término e o estouro do prazo contratual — e sugere **substitutos livres** da mesma função.

Toda movimentação confirmada fica registrada no **Histórico** (quem, para onde, período, motivo/demanda e o impacto calculado).

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Banco / Auth / Tempo real | Supabase (Postgres + RLS + Realtime) |
| Hospedagem | Vercel |
| Testes | Vitest (motor de impacto) |

## Como o impacto é calculado

Arquivo: [`src/lib/impacto.ts`](src/lib/impacto.ts) (funções puras, testadas em `impacto.test.ts`).

| Regra | Descrição |
|---|---|
| Pipeline | Etapas encadeadas **término-início** pela `ordem`, com defasagem (`lag`); lag negativo = sobreposição (lead). Dias corridos. |
| Cobertura diária | Para cada dia da etapa (de hoje em diante) e cada função necessária: `falta = necessário − alocados`. |
| Perda de produção | Por dia, vale a **função-gargalo**: `max(falta/necessário)`. A soma dos dias dá a perda em "dias-etapa" (produção proporcional à equipe). |
| Atraso da etapa | `⌈perda depois − perda antes⌉` — só o impacto **incremental** do remanejamento. |
| Propagação | O atraso aumenta a duração da etapa e desloca as subsequentes da mesma obra; o novo término é comparado ao prazo contratual. |
| Classificação | Crítico = estoura o prazo contratual · Atenção = atraso de etapa/consumo de folga ou destino excedente · OK = sem perda. |

Premissas simplificadoras (explícitas na tela): dias corridos, produtividade linear, relação TI entre etapas consecutivas. Servem para **decisão rápida de remanejamento**, não substituem o cronograma executivo (MS Project) nem a linha de base.

## Rodar localmente

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # testes do motor de impacto
```

Sem variáveis de ambiente o app abre em **modo demonstração**: dados de exemplo no navegador (`localStorage`), sincronizados entre abas — abra duas abas e movimente alguém para ver a atualização em tempo real.

## Deploy

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. **SQL Editor** → cole e execute [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   Cria as tabelas, RLS (cada usuário vê só os próprios dados), publicação Realtime e a função `mover_colaborador` (movimentação atômica + histórico).
3. **Authentication → Providers → Email**: mantenha habilitado. Para testes, pode desativar "Confirm email".
4. **Project Settings → API**: copie `Project URL` e `anon public key`.

### 2. Vercel

1. **Add New → Project** → importe este repositório do GitHub.
2. Em **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ou `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — o app aceita os dois nomes)
3. Deploy. Depois, em Supabase → **Authentication → URL Configuration**, informe a URL da Vercel em *Site URL*.

Para desenvolvimento local conectado ao Supabase, copie `.env.example` para `.env.local` e preencha.

## Estrutura

```
src/
  app/                 páginas: Painel, Movimentar, Obras e pipeline, Colaboradores, Histórico
  components/          Shell, Pipeline (Gantt), alertas, login, provider de dados/tempo real
  lib/
    cronograma.ts      montagem do pipeline (datas das etapas, término previsto, folga)
    impacto.ts         motor de impacto (simulação, alertas do portfólio, substitutos)
    repositorio/       Supabase (produção) e demo (localStorage)
supabase/migrations/   schema SQL
```
