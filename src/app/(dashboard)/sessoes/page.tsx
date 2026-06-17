"use client";
import { Card } from "@/shared/components/Card";
import { Header } from "@/shared/components/Header";
import { Badge } from "@/shared/components/Badge";
import { useSessions } from "@/hooks/useSessions";
import { useAthletes } from "@/hooks/useAthletes";
import Link from "next/link";

export default function SessoesPage() {
  const sessions = useSessions();
  const { athletes } = useAthletes();
  const nameOf = (id: string) => athletes.find((a) => a.id === id)?.nome ?? id;

  return (
    <>
      <Header />
      <div className="flex-1 p-6 space-y-4 max-w-[1400px] w-full mx-auto">
        <h1 className="text-xl font-semibold">Sessões de Treino</h1>
        {sessions.length === 0 ? (
          <Card className="border-dashed text-center">
            <p className="text-sm text-text-muted">
              Nenhuma sessão ainda. Conclua uma tentativa em{" "}
              <span className="font-bold text-sesi-red-500">Análise ao Vivo</span> para registrar a primeira.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => {
              const dataFmt = new Date(s.data + "T00:00:00").toLocaleDateString("pt-BR");
              const best = s.attempts.reduce((m, a) => Math.max(m, a.metrics.peakVelocity), 0);
              return (
                <Card key={s.id} hoverable>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{nameOf(s.athleteId)}</p>
                      <p className="text-xs text-text-muted">
                        {dataFmt}
                        {best > 0 && <> · vel. máx {best.toFixed(2)} m/s</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="primary" size="sm">
                        {s.attempts.length} tentativa{s.attempts.length !== 1 ? "s" : ""}
                      </Badge>
                      <Link
                        href={`/relatorio?athlete=${s.athleteId}&session=${s.id}`}
                        className="text-sm font-medium text-track-700 hover:underline"
                      >
                        Ver relatório →
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
