"use client";
import { useMemo, useState } from "react";
import { Card } from "@/shared/components/Card";
import { Header } from "@/shared/components/Header";
import { Badge } from "@/shared/components/Badge";
import { useSessions } from "@/hooks/useSessions";
import { useAthletes } from "@/hooks/useAthletes";
import { espRawToCsv, downloadCsv } from "@/lib/exportCsv";
import type { Attempt } from "@/lib/types";
import Link from "next/link";
import { HiOutlineTableCells } from "react-icons/hi2";

export default function SessoesPage() {
  const { athletes } = useAthletes();
  const [filterAthleteId, setFilterAthleteId] = useState<string | null>(null);
  const sessions = useSessions(filterAthleteId);
  const nameOf = (id: string) => athletes.find((a) => a.id === id)?.nome ?? id;
  const catOf = (id: string) => athletes.find((a) => a.id === id)?.categoria ?? "—";

  // Lista PLANA de tentativas (não agrupada por sessão), mais recente primeiro.
  const attempts = useMemo(
    () => sessions.flatMap((s) => s.attempts).sort((a, b) => b.startedAt - a.startedAt),
    [sessions],
  );

  // CSV bruto literal da ESP de UMA tentativa — um arquivo por tentativa.
  function downloadAttemptRaw(a: Attempt) {
    if (!a.rawSamples?.length) {
      alert(
        "Esta tentativa não tem dados brutos da ESP.\n\n" +
        "O stream cru (time,Ax,Angulo_graus,Pulsos,Vel_ms) passou a ser gravado nesta " +
        "versão — tentativas antigas não o têm. Faça uma nova captura ao vivo.",
      );
      return;
    }
    const nome = nameOf(a.athleteId).replace(/\s+/g, "_");
    const stamp = new Date(a.startedAt).toISOString().slice(0, 10);
    downloadCsv(`bruto_${nome}_T${a.numero}_${stamp}.csv`, espRawToCsv(a), false);
  }

  return (
    <>
      <Header />
      <div className="flex-1 p-6 space-y-4 max-w-[1400px] w-full mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-semibold">Tentativas</h1>
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
        {attempts.length === 0 ? (
          <Card className="border-dashed text-center">
            <p className="text-sm text-text-muted">
              Nenhuma tentativa ainda. Conclua uma tentativa em{" "}
              <span className="font-bold text-sesi-red-500">Análise ao Vivo</span> para registrar a primeira.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {attempts.map((a) => {
              const dt = new Date(a.startedAt);
              const dataFmt = dt.toLocaleDateString("pt-BR");
              const horaFmt = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
              const exitMean = a.metrics.exitMeanVelocity;
              return (
                <Card key={a.id} hoverable>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {nameOf(a.athleteId)} <span className="text-text-muted font-normal">— {catOf(a.athleteId)}</span>
                      </p>
                      <p className="text-xs text-text-muted">
                        {dataFmt} {horaFmt} · <span className="font-semibold text-text">Tentativa #{a.numero}</span> · {a.distance ?? 100}m
                      </p>
                    </div>

                    <div className="flex items-center gap-5 flex-wrap">
                      <Metric label="Vel. pico" value={`${a.metrics.peakVelocity.toFixed(2)}`} unit="m/s" />
                      <Metric label="Vel. saída" value={exitMean != null ? exitMean.toFixed(2) : "—"} unit={exitMean != null ? "m/s" : ""} />
                      <Metric label="Ângulo" value={`${a.metrics.startAngle}`} unit="°" />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={a.status === "completa" ? "optimal" : a.status === "ao-vivo" ? "live" : a.status === "parcial" ? "warning" : "critical"}
                        size="sm"
                      >
                        {a.status}
                      </Badge>
                      <button
                        onClick={() => downloadAttemptRaw(a)}
                        disabled={!a.rawSamples?.length}
                        title={a.rawSamples?.length ? "Baixar dados brutos da ESP desta tentativa (CSV)" : "Esta tentativa não tem dados brutos"}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border border-border hover:bg-track-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <HiOutlineTableCells className="w-3.5 h-3.5" /> Bruto
                      </button>
                      <Link
                        href={`/relatorio?athlete=${a.athleteId}&session=${a.sessionId}`}
                        className="text-sm font-medium text-track-700 hover:underline"
                      >
                        Relatório →
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

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold">{label}</span>
      <span className="text-sm font-bold tabular-nums">
        {value}
        {unit && <span className="text-xs text-text-muted font-normal"> {unit}</span>}
      </span>
    </div>
  );
}
