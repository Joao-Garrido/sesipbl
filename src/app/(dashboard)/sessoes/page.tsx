"use client";
import { useState } from "react";
import { Card } from "@/shared/components/Card";
import { Header } from "@/shared/components/Header";
import { Badge } from "@/shared/components/Badge";
import { useSessions } from "@/hooks/useSessions";
import { useAthletes } from "@/hooks/useAthletes";
import { rawCurveToCsv, attemptsToCsv, downloadCsv } from "@/lib/exportCsv";
import * as store from "@/lib/localStore";
import Link from "next/link";
import { HiOutlineTableCells, HiOutlineDocumentArrowDown } from "react-icons/hi2";

export default function SessoesPage() {
  const { athletes } = useAthletes();
  const [filterAthleteId, setFilterAthleteId] = useState<string | null>(null);
  const sessions = useSessions(filterAthleteId);
  const nameOf = (id: string) => athletes.find((a) => a.id === id)?.nome ?? id;

  const infoOf = (id: string) => {
    const a = athletes.find((x) => x.id === id);
    return { nome: a?.nome ?? id, categoria: a?.categoria ?? "—", refAngulo: a?.referenciaAngulo ?? 45 };
  };

  function downloadRawCsv(sessionId: string, athleteId: string) {
    const attempts = store.getAttemptsBySession(sessionId);
    if (!attempts.length) return;
    const nome = (nameOf(athleteId)).replace(/\s+/g, "_");
    const stamp = new Date().toISOString().slice(0, 10);
    // Um CSV por tentativa concatenado (header repetido por tentativa para clareza)
    const csvParts = attempts.map((a) => rawCurveToCsv(a, infoOf));
    downloadCsv(`bruto_${nome}_${stamp}.csv`, csvParts.join("\r\n"));
  }

  function downloadReportCsv(sessionId: string, athleteId: string) {
    const attempts = store.getAttemptsBySession(sessionId);
    if (!attempts.length) return;
    const nome = (nameOf(athleteId)).replace(/\s+/g, "_");
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`relatorio_${nome}_${stamp}.csv`, attemptsToCsv(attempts, infoOf));
  }

  return (
    <>
      <Header />
      <div className="flex-1 p-6 space-y-4 max-w-[1400px] w-full mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-semibold">Sessões de Treino</h1>
          <select
            value={filterAthleteId ?? ""}
            onChange={(e) => setFilterAthleteId(e.target.value || null)}
            className="text-sm px-3 py-1.5 rounded-lg border border-border bg-white"
          >
            <option value="">Todos os atletas</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>{a.nome} — {a.categoria}</option>
            ))}
          </select>
        </div>
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
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-semibold">{nameOf(s.athleteId)}</p>
                      <p className="text-xs text-text-muted">
                        {dataFmt}
                        {best > 0 && <> · vel. máx {best.toFixed(2)} m/s</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="primary" size="sm">
                        {s.attempts.length} tentativa{s.attempts.length !== 1 ? "s" : ""}
                      </Badge>
                      <button
                        onClick={() => downloadRawCsv(s.id, s.athleteId)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border border-border hover:bg-track-50 transition"
                        title="Baixar dados brutos do encoder (CSV)"
                      >
                        <HiOutlineTableCells className="w-3.5 h-3.5" /> Bruto
                      </button>
                      <button
                        onClick={() => downloadReportCsv(s.id, s.athleteId)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border border-border hover:bg-track-50 transition"
                        title="Baixar relatório agregado (CSV)"
                      >
                        <HiOutlineDocumentArrowDown className="w-3.5 h-3.5" /> Relatório
                      </button>
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
