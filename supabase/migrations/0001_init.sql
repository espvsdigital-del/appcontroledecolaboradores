-- =====================================================================
-- Mapa de Equipes — schema inicial
-- Cada usuário (gestor) enxerga apenas os próprios dados (RLS por owner_id).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Obras
-- ---------------------------------------------------------------------
create table if not exists public.obras (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome                text not null,
  cliente             text not null default '',
  local               text,
  data_inicio         date not null,
  data_fim_contratual date,
  cor                 text not null default '#2563eb',
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Etapas (pipeline da obra)
-- Encadeamento término-início (TI) com a etapa anterior (por "ordem"),
-- com defasagem (lag_dias) — negativa = sobreposição (lead).
-- necessidades = [{ "funcao": "Pedreiro", "quantidade": 3 }, ...]
-- ---------------------------------------------------------------------
create table if not exists public.etapas (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  obra_id       uuid not null references public.obras(id) on delete cascade,
  nome          text not null,
  ordem         integer not null default 1,
  duracao_dias  integer not null check (duracao_dias > 0),
  lag_dias      integer not null default 0,
  necessidades  jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists etapas_obra_idx on public.etapas (obra_id, ordem);

-- ---------------------------------------------------------------------
-- Colaboradores
-- ---------------------------------------------------------------------
create table if not exists public.colaboradores (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome        text not null,
  funcao      text not null,
  telefone    text,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Alocações (onde cada colaborador está, por período)
-- ---------------------------------------------------------------------
create table if not exists public.alocacoes (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  etapa_id        uuid not null references public.etapas(id) on delete cascade,
  data_inicio     date not null,
  data_fim        date not null,
  created_at      timestamptz not null default now(),
  constraint alocacoes_periodo_ck check (data_fim >= data_inicio)
);
create index if not exists alocacoes_colab_idx on public.alocacoes (colaborador_id, data_inicio);
create index if not exists alocacoes_etapa_idx on public.alocacoes (etapa_id);

-- ---------------------------------------------------------------------
-- Histórico de movimentações (trilha de auditoria / governança)
-- ---------------------------------------------------------------------
create table if not exists public.movimentacoes (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  colaborador_id  uuid references public.colaboradores(id) on delete set null,
  etapa_id        uuid references public.etapas(id) on delete set null,
  data_inicio     date not null,
  data_fim        date not null,
  motivo          text not null default '',
  nivel           text not null check (nivel in ('ok', 'atencao', 'critico')),
  resumo          text not null default '',
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.obras          enable row level security;
alter table public.etapas         enable row level security;
alter table public.colaboradores  enable row level security;
alter table public.alocacoes      enable row level security;
alter table public.movimentacoes  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['obras', 'etapas', 'colaboradores', 'alocacoes', 'movimentacoes'] loop
    execute format('drop policy if exists "dono_%1$s" on public.%1$I', t);
    execute format(
      'create policy "dono_%1$s" on public.%1$I for all to authenticated
         using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['obras', 'etapas', 'colaboradores', 'alocacoes', 'movimentacoes'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- RPC: mover colaborador (atômico)
-- Recorta as alocações do colaborador que se sobrepõem ao período,
-- cria a nova alocação (se houver destino) e registra no histórico.
-- p_etapa_id nulo = liberar / afastar no período.
-- Mesma regra de src/lib/impacto.ts → aplicarMovimento().
-- ---------------------------------------------------------------------
create or replace function public.mover_colaborador(
  p_colaborador_id uuid,
  p_etapa_id       uuid,
  p_inicio         date,
  p_fim            date,
  p_motivo         text,
  p_nivel          text,
  p_resumo         text
) returns void
language plpgsql
security invoker
as $$
declare a record;
begin
  if p_fim < p_inicio then
    raise exception 'Período inválido';
  end if;

  for a in
    select * from public.alocacoes
    where colaborador_id = p_colaborador_id
      and data_inicio <= p_fim and data_fim >= p_inicio
    for update
  loop
    if a.data_inicio < p_inicio and a.data_fim > p_fim then
      update public.alocacoes set data_fim = p_inicio - 1 where id = a.id;
      insert into public.alocacoes (colaborador_id, etapa_id, data_inicio, data_fim)
      values (a.colaborador_id, a.etapa_id, p_fim + 1, a.data_fim);
    elsif a.data_inicio < p_inicio then
      update public.alocacoes set data_fim = p_inicio - 1 where id = a.id;
    elsif a.data_fim > p_fim then
      update public.alocacoes set data_inicio = p_fim + 1 where id = a.id;
    else
      delete from public.alocacoes where id = a.id;
    end if;
  end loop;

  if p_etapa_id is not null then
    insert into public.alocacoes (colaborador_id, etapa_id, data_inicio, data_fim)
    values (p_colaborador_id, p_etapa_id, p_inicio, p_fim);
  end if;

  insert into public.movimentacoes (colaborador_id, etapa_id, data_inicio, data_fim, motivo, nivel, resumo)
  values (p_colaborador_id, p_etapa_id, p_inicio, p_fim, coalesce(p_motivo, ''), p_nivel, coalesce(p_resumo, ''));
end;
$$;

grant execute on function public.mover_colaborador(uuid, uuid, date, date, text, text, text) to authenticated;
