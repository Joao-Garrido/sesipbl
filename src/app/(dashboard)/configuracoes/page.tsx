import Link from "next/link";
import { Card } from "@/shared/components/Card";
import { Header } from "@/shared/components/Header";
import { CalibrationSelector } from "./CalibrationSelector";

export default function ConfiguracoesPage() {
  return (
    <>
      <Header />
      <div className="flex-1 p-6 space-y-4 max-w-[1400px] w-full mx-auto">
        <h1 className="text-xl font-semibold">Configurações</h1>

        <Card title="Hardware">
          <div className="space-y-3 text-sm">
            <p className="text-text-muted leading-relaxed">
              O sistema lê o encoder da carretilha e uma IMU pela porta serial,
              repassados ao navegador pelo servidor local
              (<code className="font-mono-num">server.py</code>).
            </p>
            <ul className="space-y-1.5 text-text-muted">
              <li>• <span className="text-text font-medium">Encoder</span> — 600 PPR ×4 = 2400 transições/volta.</li>
              <li>• <span className="text-text font-medium">IMU</span> — eixo X (ângulo já calculado no firmware).</li>
              <li>• <span className="text-text font-medium">ESP32 → servidor local</span> — CSV de 5 colunas (time, Ax, Angulo_graus, Pulsos, Vel_ms), 115200 baud.</li>
            </ul>
            <p className="text-text-muted">
              O estado real de conexão (encoder / IMU / sinal) aparece ao vivo no painel de{" "}
              <Link href="/live" className="font-semibold text-sesi-red-500 hover:underline">Análise ao Vivo</Link>{" "}
              — lá os indicadores ficam verdes só quando chega dado de verdade.
            </p>
          </div>
        </Card>

        <Card title="Calibração">
          <div className="space-y-4 text-sm">
            <div className="space-y-2">
              <p className="font-medium text-text">Modo de distância / velocidade</p>
              <p className="text-text-muted leading-relaxed">
                Escolha como o deslocamento e a velocidade são calculados a partir
                do encoder. Vale na hora para a{" "}
                <Link href="/live" className="font-semibold text-sesi-red-500 hover:underline">Análise ao Vivo</Link>.
              </p>
              <CalibrationSelector />
            </div>
            <p className="text-text-muted leading-relaxed border-t border-border pt-3">
              Cada atleta também tem um ângulo de largada de referência (zona verde ±5°),
              configurável no cadastro em{" "}
              <Link href="/atletas" className="font-semibold text-sesi-red-500 hover:underline">Atletas</Link>.
            </p>
          </div>
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
