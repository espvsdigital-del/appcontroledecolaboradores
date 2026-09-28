import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Dados } from "../tipos";
import type { Repositorio } from "./tipos";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Aceita o nome antigo (anon) e o novo (publishable) exibido no painel do Supabase.
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigurado = Boolean(url && anon);

let cliente: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!cliente) cliente = createClient(url!, anon!);
  return cliente;
}

const TABELAS = ["obras", "etapas", "colaboradores", "alocacoes", "movimentacoes"] as const;

function ok<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

export function criarRepositorioSupabase(): Repositorio {
  const sb = supabase();
  return {
    modo: "supabase",

    async carregar(): Promise<Dados> {
      const [obras, etapas, colaboradores, alocacoes, movimentacoes] = await Promise.all([
        sb.from("obras").select("id,nome,cliente,local,data_inicio,data_fim_contratual,cor").order("data_inicio"),
        sb.from("etapas").select("id,obra_id,nome,ordem,duracao_dias,lag_dias,necessidades").order("ordem"),
        sb.from("colaboradores").select("id,nome,funcao,telefone,ativo").order("nome"),
        sb.from("alocacoes").select("id,colaborador_id,etapa_id,data_inicio,data_fim"),
        sb
          .from("movimentacoes")
          .select("id,colaborador_id,etapa_id,data_inicio,data_fim,motivo,nivel,resumo,created_at")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      return {
        obras: ok(obras) ?? [],
        etapas: ok(etapas) ?? [],
        colaboradores: ok(colaboradores) ?? [],
        alocacoes: ok(alocacoes) ?? [],
        movimentacoes: ok(movimentacoes) ?? [],
      } as Dados;
    },

    assinar(aoMudar) {
      const canal = sb.channel("mapa-equipes");
      for (const t of TABELAS) {
        canal.on("postgres_changes", { event: "*", schema: "public", table: t }, () => aoMudar());
      }
      canal.subscribe();
      return () => {
        sb.removeChannel(canal);
      };
    },

    async salvarObra(o) {
      ok(await sb.from("obras").upsert(o));
    },
    async excluirObra(id) {
      ok(await sb.from("obras").delete().eq("id", id));
    },
    async salvarEtapa(e) {
      ok(await sb.from("etapas").upsert(e));
    },
    async excluirEtapa(id) {
      ok(await sb.from("etapas").delete().eq("id", id));
    },
    async salvarColaborador(c) {
      ok(await sb.from("colaboradores").upsert(c));
    },
    async excluirColaborador(id) {
      ok(await sb.from("colaboradores").delete().eq("id", id));
    },
    async excluirAlocacao(id) {
      ok(await sb.from("alocacoes").delete().eq("id", id));
    },
    async moverColaborador(m) {
      ok(
        await sb.rpc("mover_colaborador", {
          p_colaborador_id: m.colaborador_id,
          p_etapa_id: m.etapa_id,
          p_inicio: m.data_inicio,
          p_fim: m.data_fim,
          p_motivo: m.motivo,
          p_nivel: m.nivel,
          p_resumo: m.resumo,
        }),
      );
    },
  };
}
