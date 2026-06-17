import Link from "next/link";
import { Card } from "@/shared/components/Card";
import { Header } from "@/shared/components/Header";

export default function ConfiguracoesPage() {
  return (
    <>
      <Header />
      <div className="flex-1 p-6 space-y-4 max-w-[1400px] w-full mx-auto">
        <h1 className="text-xl font-semibold">Configurações</h1>

        <Card title="Hardware">
          <div className="space-y-3 text-sm">
            <p className="text-text-muted leading-relaxed">
              O sistema lê o encoder da carretilha e duas IMUs (carretilha + atleta)
              pela porta serial, repassadas ao navegador pelo servidor local
              (<code className="font-mono-num">server.py</code>).
            </p>
            <ul className="space-y-1.5 text-text-muted">
              <li>• <span className="text-text font-medium">Encoder</span> — 600 PPR ×4 = 2400 transições/volta, roda Ø 5,0 cm.</li>
              <li>• <span className="text-text font-medium">IMUs</span> — uma na carretilha, uma no atleta (via ESP-NOW).</li>
              <li>• <span className="text-text font-medium">ESP32 → servidor local</span> — CSV de 15 colunas, 115200 baud.</li>
            </ul>
            <p className="text-text-muted">
              O estado real de conexão (encoder / IMU / sinal) aparece ao vivo no painel de{" "}
              <Link href="/live" className="font-semibold text-sesi-red-500 hover:underline">Análise ao Vivo</Link>{" "}
              — lá os indicadores ficam verdes só quando chega dado de verdade.
            </p>
          </div>
        </Card>

        <Card title="Calibração">
          <p className="text-sm text-text-muted leading-relaxed">
            Cada atleta tem um ângulo de largada de referência (zona verde ±5°),
            configurável no cadastro em{" "}
            <Link href="/atletas" className="font-semibold text-sesi-red-500 hover:underline">Atletas</Link>.
            Para o ângulo sair correto, inicie a captura com a carretilha parada — os
            primeiros instantes calibram o zero do giroscópio.
          </p>
        </Card>

        <Card title="Onde ficam os dados">
          <p className="text-sm text-text-muted leading-relaxed">
            Atletas e tentativas são salvos na sua máquina em{" "}
            <code className="font-mono-num">local-mvp/data/store.json</code>{" "}
            (cópia de segurança no navegador). Para backup, basta copiar esse arquivo.
          </p>
        </Card>
      </div>
    </>
  );
}
