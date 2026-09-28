"use client";

import { useState } from "react";
import { supabase } from "@/lib/repositorio/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [msg, setMsg] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setMsg(null);
    const sb = supabase();
    const { error, data } =
      modo === "entrar"
        ? await sb.auth.signInWithPassword({ email, password: senha })
        : await sb.auth.signUp({ email, password: senha });
    setEnviando(false);
    if (error) setMsg(error.message);
    else if (modo === "criar" && !data.session) setMsg("Conta criada. Confirme pelo e-mail recebido e depois entre.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form onSubmit={enviar} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow">
        <div>
          <h1 className="text-xl font-semibold">Mapa de Equipes</h1>
          <p className="text-sm text-slate-500">Alocação de equipes de obra em tempo real</p>
        </div>
        <label className="block">
          <span className="rotulo">E-mail</span>
          <input className="campo" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block">
          <span className="rotulo">Senha</span>
          <input className="campo" type="password" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>
        {msg && <p className="text-sm text-amber-700">{msg}</p>}
        <button className="botao w-full" disabled={enviando}>
          {modo === "entrar" ? "Entrar" : "Criar conta"}
        </button>
        <button
          type="button"
          className="w-full text-sm text-blue-700 hover:underline"
          onClick={() => setModo(modo === "entrar" ? "criar" : "entrar")}
        >
          {modo === "entrar" ? "Não tem conta? Criar" : "Já tenho conta"}
        </button>
      </form>
    </div>
  );
}
