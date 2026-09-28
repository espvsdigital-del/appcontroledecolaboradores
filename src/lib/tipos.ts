export type Nivel = "ok" | "atencao" | "critico";

export interface Necessidade {
  funcao: string;
  quantidade: number;
}

export interface Obra {
  id: string;
  nome: string;
  cliente: string;
  local: string | null;
  /** YYYY-MM-DD */
  data_inicio: string;
  /** YYYY-MM-DD — prazo contratual de término (opcional) */
  data_fim_contratual: string | null;
  cor: string;
}

export interface Etapa {
  id: string;
  obra_id: string;
  nome: string;
  ordem: number;
  duracao_dias: number;
  /** Defasagem em relação ao término da etapa anterior (negativa = sobreposição). */
  lag_dias: number;
  necessidades: Necessidade[];
}

export interface Colaborador {
  id: string;
  nome: string;
  funcao: string;
  telefone: string | null;
  ativo: boolean;
}

export interface Alocacao {
  id: string;
  colaborador_id: string;
  etapa_id: string;
  data_inicio: string;
  data_fim: string;
}

export interface Movimentacao {
  id: string;
  colaborador_id: string | null;
  etapa_id: string | null;
  data_inicio: string;
  data_fim: string;
  motivo: string;
  nivel: Nivel;
  resumo: string;
  created_at: string;
}

export interface Dados {
  obras: Obra[];
  etapas: Etapa[];
  colaboradores: Colaborador[];
  alocacoes: Alocacao[];
  movimentacoes: Movimentacao[];
}

/** Remanejamento de um colaborador para uma etapa (ou liberação, se etapa_id = null). */
export interface Movimento {
  colaborador_id: string;
  etapa_id: string | null;
  data_inicio: string;
  data_fim: string;
}
