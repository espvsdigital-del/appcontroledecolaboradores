"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { restaurarDemo } from "@/lib/repositorio/demo";
import { useDados } from "./DadosProvider";

const MENU = [
  { href: "/", rotulo: "Painel" },
  { href: "/movimentar", rotulo: "Movimentar" },
  { href: "/obras", rotulo: "Obras e pipeline" },
  { href: "/colaboradores", rotulo: "Colaboradores" },
  { href: "/historico", rotulo: "Histórico" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const caminho = usePathname();
  const { repo, erro, ultimaAtualizacao, sair, email } = useDados();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="text-lg font-bold text-slate-900">
            Mapa de Equipes
          </Link>
          <nav className="flex flex-wrap gap-1">
            {MENU.map((m) => {
              const ativo = m.href === "/" ? caminho === "/" : caminho.startsWith(m.href);
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    ativo ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {m.rotulo}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
            {repo.modo === "supabase" ? (
              <span className="flex items-center gap-1.5" title={ultimaAtualizacao?.toLocaleTimeString("pt-BR")}>
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" /> Tempo real
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-800">Modo demonstração</span>
                <button
                  className="text-blue-700 hover:underline"
                  onClick={() => confirm("Restaurar os dados de exemplo? As alterações locais serão perdidas.") && restaurarDemo()}
                >
                  restaurar exemplo
                </button>
              </span>
            )}
            {email && <span className="hidden sm:inline">{email}</span>}
            {sair && (
              <button className="botao-sec" onClick={sair}>
                Sair
              </button>
            )}
          </div>
        </div>
      </header>
      {erro && (
        <div className="mx-auto mt-4 max-w-7xl px-4">
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">Erro ao carregar dados: {erro}</div>
        </div>
      )}
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
