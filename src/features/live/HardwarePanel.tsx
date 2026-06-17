"use client";
import { HiOutlineWifi, HiOutlineBolt, HiOutlineCpuChip, HiOutlineSignal } from "react-icons/hi2";
import type { HardwareStatus } from "@/lib/types";

interface Props {
  hw: HardwareStatus;
}

function statusColor(s: "ok" | "warn" | "fail"): string {
  return s === "ok" ? "bg-emerald-500" : s === "warn" ? "bg-amber-500" : "bg-red-500";
}

function rssiBars(rssi: number): number {
  if (rssi >= -55) return 4;
  if (rssi >= -65) return 3;
  if (rssi >= -75) return 2;
  return 1;
}

export function HardwarePanel({ hw }: Props) {
  // Sentinela: rssi=0 e battery=0 significam "nao medido pela ESP".
  // Renderiza "—" ao inves de valores fake.
  const hasRssi = hw.rssi !== 0;
  const hasBattery = hw.battery !== 0;
  const bars = hasRssi ? rssiBars(hw.rssi) : 0;
  const battColor = hw.battery > 30 ? "text-emerald-500" : hw.battery > 15 ? "text-amber-500" : "text-red-500";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
      {/* Encoder */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sesi-black/[0.03] border border-border">
        <span className={`w-1.5 h-1.5 rounded-full ${statusColor(hw.encoder)}`} />
        <HiOutlineSignal className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-text-muted">Encoder</span>
        <span className="ml-auto font-bold text-text uppercase tracking-wider">{hw.encoder}</span>
      </div>
      {/* IMU */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sesi-black/[0.03] border border-border">
        <span className={`w-1.5 h-1.5 rounded-full ${statusColor(hw.imu)}`} />
        <HiOutlineCpuChip className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-text-muted">IMU</span>
        <span className="ml-auto font-bold text-text uppercase tracking-wider">{hw.imu}</span>
      </div>
      {/* WiFi RSSI */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sesi-black/[0.03] border border-border">
        <HiOutlineWifi className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-text-muted">Sinal</span>
        {hasRssi ? (
          <>
            <span className="flex items-end gap-0.5 ml-auto">
              {[1, 2, 3, 4].map((b) => (
                <span key={b} className={`w-0.5 rounded-sm ${b <= bars ? "bg-sesi-red-500" : "bg-border"}`} style={{ height: `${b * 2 + 2}px` }} />
              ))}
            </span>
            <span className="font-mono-num text-text font-semibold tabular-nums">{hw.rssi}<span className="text-[9px] text-text-muted ml-0.5">dBm</span></span>
          </>
        ) : (
          <span className="ml-auto text-text-muted font-mono-num">—</span>
        )}
      </div>
      {/* Battery */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sesi-black/[0.03] border border-border">
        <HiOutlineBolt className={`w-3.5 h-3.5 ${hasBattery ? battColor : "text-text-muted"}`} />
        <span className="text-text-muted">Bateria</span>
        {hasBattery ? (
          <span className="ml-auto flex items-center gap-1.5">
            <span className="relative w-7 h-3 border border-text-muted rounded-sm">
              <span className="absolute inset-y-0 left-0 rounded-sm bg-emerald-500" style={{ width: `${hw.battery}%` }} />
              <span className="absolute -right-0.5 top-0.5 bottom-0.5 w-0.5 rounded-r bg-text-muted" />
            </span>
            <span className="font-mono-num font-semibold tabular-nums">{hw.battery}%</span>
          </span>
        ) : (
          <span className="ml-auto text-text-muted font-mono-num">—</span>
        )}
      </div>
    </div>
  );
}
