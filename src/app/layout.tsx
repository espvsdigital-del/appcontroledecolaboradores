import type { Metadata } from "next";
import "./globals.css";
import DadosProvider from "@/components/DadosProvider";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "Mapa de Equipes",
  description: "Onde estão as equipes de obra e como cada remanejamento afeta obras, clientes e etapas.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <DadosProvider>
          <Shell>{children}</Shell>
        </DadosProvider>
      </body>
    </html>
  );
}
