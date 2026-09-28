import type { Nivel } from "@/lib/tipos";

export const ESTILO_NIVEL: Record<Nivel, { rotulo: string; badge: string; caixa: string; ponto: string }> = {
  ok: {
    rotulo: "OK",
    badge: "bg-green-100 text-green-800",
    caixa: "border-green-300 bg-green-50",
    ponto: "bg-green-500",
  },
  atencao: {
    rotulo: "Atenção",
    badge: "bg-amber-100 text-amber-800",
    caixa: "border-amber-300 bg-amber-50",
    ponto: "bg-amber-500",
  },
  critico: {
    rotulo: "Crítico",
    badge: "bg-red-100 text-red-800",
    caixa: "border-red-300 bg-red-50",
    ponto: "bg-red-500",
  },
};

export function NivelBadge({ nivel }: { nivel: Nivel }) {
  const e = ESTILO_NIVEL[nivel];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${e.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${e.ponto}`} />
      {e.rotulo}
    </span>
  );
}

export function CaixaAlerta({
  nivel,
  titulo,
  detalhes,
}: {
  nivel: Nivel;
  titulo: string;
  detalhes: string[];
}) {
  return (
    <div className={`rounded-lg border p-3 ${ESTILO_NIVEL[nivel].caixa}`}>
      <div className="flex items-start gap-2">
        <NivelBadge nivel={nivel} />
        <p className="text-sm font-semibold text-slate-800">{titulo}</p>
      </div>
      {detalhes.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-6 text-sm text-slate-700">
          {detalhes.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
