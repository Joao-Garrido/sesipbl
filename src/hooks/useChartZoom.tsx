"use client";
// Zoom por arraste para gráficos recharts (eixo X numérico).
// Arraste para selecionar um intervalo → amplia. Botão "Reset" volta à visão cheia.
//
// Uso no componente do gráfico:
//   const zoom = useChartZoom(defaultDomain);
//   <div className="relative">
//     <ZoomControls isZoomed={zoom.isZoomed} onReset={zoom.reset} />
//     <ResponsiveContainer> <XChart {...zoom.handlers}>
//        <XAxis domain={zoom.domain} allowDataOverflow type="number" />
//        {zoom.sel.l != null && zoom.sel.r != null && (
//          <ReferenceArea x1={zoom.sel.l} x2={zoom.sel.r} fill="#B91C2C" fillOpacity={0.12} />
//        )}
//   (o <ReferenceArea> precisa ser filho DIRETO do gráfico — por isso fica inline.)
import { useRef, useState } from "react";
import { HiOutlineMagnifyingGlassMinus } from "react-icons/hi2";

type DomainBound = number | string;
interface ActivePayload {
  activeLabel?: number | string;
}

export function useChartZoom(defaultDomain: [DomainBound, DomainBound]) {
  const [zoom, setZoom] = useState<[number, number] | null>(null);
  const [sel, setSel] = useState<{ l: number | null; r: number | null }>({ l: null, r: null });
  const dragging = useRef(false);

  const onMouseDown = (e: ActivePayload | null) => {
    const x = e?.activeLabel;
    if (x == null) return;
    dragging.current = true;
    setSel({ l: +x, r: +x });
  };
  const onMouseMove = (e: ActivePayload | null) => {
    if (!dragging.current) return;
    const x = e?.activeLabel;
    if (x == null) return;
    setSel((s) => ({ ...s, r: +x }));
  };
  const onMouseUp = () => {
    dragging.current = false;
    setSel((s) => {
      if (s.l != null && s.r != null && Math.abs(s.l - s.r) > 0.001) {
        setZoom([Math.min(s.l, s.r), Math.max(s.l, s.r)]);
      }
      return { l: null, r: null };
    });
  };
  const onMouseLeave = () => {
    if (dragging.current) {
      dragging.current = false;
      setSel({ l: null, r: null });
    }
  };

  return {
    domain: (zoom ?? defaultDomain) as [DomainBound, DomainBound],
    isZoomed: zoom != null,
    sel,
    handlers: { onMouseDown, onMouseMove, onMouseUp, onMouseLeave },
    reset: () => setZoom(null),
  };
}

export function ZoomControls({ isZoomed, onReset }: { isZoomed: boolean; onReset: () => void }) {
  return isZoomed ? (
    <button
      onClick={onReset}
      className="absolute top-1 right-1 z-10 flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-sesi-black text-white hover:bg-sesi-charcoal shadow-sm transition"
    >
      <HiOutlineMagnifyingGlassMinus className="w-3.5 h-3.5" /> Reset
    </button>
  ) : (
    <span className="absolute top-1 right-2 z-10 text-[10px] text-text-muted/70 pointer-events-none select-none">
      arraste ↔ p/ zoom
    </span>
  );
}
