import type { Colaborador, Dados, Etapa, Movimento, Nivel, Obra } from "../tipos";

export interface RegistroMovimento extends Movimento {
  motivo: string;
  nivel: Nivel;
  resumo: string;
}

export interface Repositorio {
  modo: "supabase" | "demo";
  carregar(): Promise<Dados>;
  /** Notifica qualquer alteração (de qualquer usuário/aba). Retorna função para cancelar. */
  assinar(aoMudar: () => void): () => void;
  salvarObra(o: Obra): Promise<void>;
  excluirObra(id: string): Promise<void>;
  salvarEtapa(e: Etapa): Promise<void>;
  excluirEtapa(id: string): Promise<void>;
  salvarColaborador(c: Colaborador): Promise<void>;
  excluirColaborador(id: string): Promise<void>;
  excluirAlocacao(id: string): Promise<void>;
  moverColaborador(m: RegistroMovimento): Promise<void>;
}
