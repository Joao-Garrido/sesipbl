"use client";
import { HiOutlineCpuChip, HiOutlineSignal } from "react-icons/hi2";
import type { HardwareStatus } from "@/lib/types";

interface Props {
  hw: HardwareStatus;
}

function statusColor(s: "ok" | "warn" | "fail"): string {
  return s === "ok" ? "bg-emerald-500" : s === "warn" ? "bg-amber-500" : "bg-red-500";
}

export function HardwarePanel({ hw }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
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
    </div>
  );
}
