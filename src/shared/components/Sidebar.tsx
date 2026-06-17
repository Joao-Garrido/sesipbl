"use client";
// Sidebar SESI vermelho — hover-driven collapse/expand + Vinlet animations
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  HiOutlineHome,
  HiOutlineChartBar,
  HiOutlineUsers,
  HiOutlineClipboardDocumentList,
  HiOutlineSignal,
  HiOutlineCog6Tooth,
} from "react-icons/hi2";
import { LIVE_SOURCE } from "@/hooks/useAutoLiveSession";

// Rótulo honesto do modo de operação (não "mock mode" quando há dados reais).
const MODE_LABEL = LIVE_SOURCE === "local-ws" ? "modo local" : "modo demo";

const SMOOTH_EASE = [0.22, 1, 0.36, 1] as const;
const SMOOTH_DURATION = 0.42;
const ITEM_STAGGER = 0.03;
const COLLAPSED_W = 64;
const EXPANDED_W = 240;

const items = [
  { href: "/inicio", label: "Dashboard", icon: HiOutlineHome },
  { href: "/live", label: "Análise ao Vivo", icon: HiOutlineSignal, live: true },
  { href: "/relatorio", label: "Relatórios", icon: HiOutlineChartBar },
  { href: "/atletas", label: "Atletas", icon: HiOutlineUsers },
  { href: "/sessoes", label: "Tentativas", icon: HiOutlineClipboardDocumentList },
  { href: "/configuracoes", label: "Configurações", icon: HiOutlineCog6Tooth },
];

const widthVariants: Variants = {
  open: { width: EXPANDED_W },
  closed: { width: COLLAPSED_W },
};

const labelMotion = {
  initial: { opacity: 0, x: -6 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -6 },
  transition: { duration: SMOOTH_DURATION, ease: SMOOTH_EASE },
};

const accessoryMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: SMOOTH_DURATION, ease: SMOOTH_EASE },
};

export function Sidebar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [logoSrc, setLogoSrc] = useState("/sesi-esporte.svg");
  useEffect(() => {
    setMounted(true);
    // Tenta carregar o PNG real; se falhar, mantém SVG fallback
    const probe = new window.Image();
    probe.onload = () => setLogoSrc("/sesi-esporte.png");
    probe.src = "/sesi-esporte.png";
  }, []);

  const collapsed = !hovered;

  return (
    <motion.aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      variants={widthVariants}
      animate={collapsed ? "closed" : "open"}
      initial={false}
      transition={{ type: "tween", ease: SMOOTH_EASE, duration: SMOOTH_DURATION }}
      className="bg-sesi-red-500 text-white flex flex-col relative overflow-hidden flex-shrink-0 z-40"
      style={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
    >
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ backgroundImage: "repeating-linear-gradient(135deg, white 0, white 1px, transparent 1px, transparent 8px)" }}
      />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-sesi-red-700/40 to-transparent pointer-events-none" />

      {/* Logo */}
      <div className="relative px-3 py-4 border-b border-white/15 flex items-center justify-center min-h-[72px]">
        <AnimatePresence mode="wait" initial={false}>
          {collapsed ? (
            <motion.div key="mark" {...accessoryMotion} className="flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                alt="SESI Esporte"
                width={40}
                height={44}
                className="object-contain"
                onError={() => setLogoSrc("/sesi-esporte.svg")}
              />
            </motion.div>
          ) : (
            <motion.div key="full" {...labelMotion} className="flex items-center gap-3 w-full">
              <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoSrc}
                  alt="SESI Esporte"
                  width={48}
                  height={52}
                  className="object-contain"
                  onError={() => setLogoSrc("/sesi-esporte.svg")}
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black tracking-tight leading-tight truncate">SESI Sprint</p>
                <p className="text-[10px] text-white/60 uppercase tracking-[0.18em] leading-tight">SESI São Paulo</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 relative">
        {items.map((it, i) => {
          const Icon = it.icon;
          const active = pathname?.startsWith(it.href);
          return (
            <motion.div
              key={it.href}
              initial={mounted ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: SMOOTH_DURATION, delay: i * ITEM_STAGGER, ease: SMOOTH_EASE }}
            >
              <Link
                href={it.href}
                title={collapsed ? it.label : undefined}
                className="group relative flex items-center justify-between rounded-lg text-sm transition-colors duration-200 h-10 px-3"
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active-bg"
                    className="absolute inset-0 rounded-lg bg-sesi-black/85 shadow-lg shadow-black/20"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                {active && (
                  <motion.span
                    layoutId="sidebar-active-bar"
                    className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-white"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className={`relative flex items-center gap-3 ${active ? "text-white" : "text-white/85 group-hover:text-white"}`}>
                  <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.span {...labelMotion} className="font-medium tracking-tight whitespace-nowrap">
                        {it.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <span className="relative flex items-center gap-1.5">
                  <AnimatePresence>
                    {it.live && (
                      <motion.span
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="relative flex h-1.5 w-1.5"
                      >
                        <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-70 animate-ping" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Footer CTA */}
      <div className="relative p-2 border-t border-white/15 space-y-2">
        <Link
          href="/live"
          title={collapsed ? "Nova Sessão" : undefined}
          className="w-full h-10 rounded-lg text-sm font-bold bg-sesi-black hover:bg-sesi-charcoal text-white transition-all shadow-lg shadow-black/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 ring-1 ring-white/10 px-3"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0" />
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span {...labelMotion} className="whitespace-nowrap">
                Nova Sessão
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div {...accessoryMotion} className="text-[10px] text-white/55 text-center font-mono-num tracking-wider">
              v0.1.0 · {MODE_LABEL}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
