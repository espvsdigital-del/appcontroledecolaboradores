"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { criarRepositorioDemo } from "@/lib/repositorio/demo";
import { criarRepositorioSupabase, supabase, supabaseConfigurado } from "@/lib/repositorio/supabase";
import type { Repositorio } from "@/lib/repositorio/tipos";
import type { Dados } from "@/lib/tipos";
import Login from "./Login";

interface Contexto {
  dados: Dados;
  repo: Repositorio;
  carregando: boolean;
  erro: string | null;
  ultimaAtualizacao: Date | null;
  recarregar: () => Promise<void>;
  sair: (() => Promise<void>) | null;
  email: string | null;
}

const VAZIO: Dados = { obras: [], etapas: [], colaboradores: [], alocacoes: [], movimentacoes: [] };
const Ctx = createContext<Contexto | null>(null);

export function useDados(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDados fora do DadosProvider");
  return c;
}

export default function DadosProvider({ children }: { children: React.ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [verificandoSessao, setVerificandoSessao] = useState(supabaseConfigurado);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setVerificandoSessao(false);
    });
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (verificandoSessao) return <Centro>Carregando…</Centro>;
  if (supabaseConfigurado && !sessao) return <Login />;

  return (
    <Conteudo key={sessao?.user.id ?? "demo"} email={sessao?.user.email ?? null}>
      {children}
    </Conteudo>
  );
}

function Conteudo({ children, email }: { children: React.ReactNode; email: string | null }) {
  const repo = useMemo(() => (supabaseConfigurado ? criarRepositorioSupabase() : criarRepositorioDemo()), []);
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimaAtualizacao, setUltima] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const recarregar = useCallback(async () => {
    try {
      setDados(await repo.carregar());
      setErro(null);
      setUltima(new Date());
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }, [repo]);

  useEffect(() => {
    recarregar();
    // Rajadas de eventos (ex.: RPC que altera várias linhas) viram uma única recarga.
    const cancelar = repo.assinar(() => {
      clearTimeout(timer.current);
      timer.current = setTimeout(recarregar, 250);
    });
    return () => {
      cancelar();
      clearTimeout(timer.current);
    };
  }, [repo, recarregar]);

  const sair = supabaseConfigurado
    ? async () => {
        await supabase().auth.signOut();
      }
    : null;

  return (
    <Ctx.Provider value={{ dados, repo, carregando, erro, ultimaAtualizacao, recarregar, sair, email }}>
      {children}
    </Ctx.Provider>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center text-slate-500">{children}</div>;
}
