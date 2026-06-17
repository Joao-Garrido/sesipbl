import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SESI Sprint",
  description: "Análise cinemática de velocidade, deslocamento e ângulo de largada em provas de velocidade.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
