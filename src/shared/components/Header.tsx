"use client";
import { Badge } from "./Badge";

interface HeaderProps {
  athleteName?: string;
  isLive?: boolean;
  rightSlot?: React.ReactNode;
}

export function Header({ athleteName, isLive, rightSlot }: HeaderProps) {
  return (
    <header className="h-14 bg-white border-b border-border px-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {athleteName && (
          <span className="text-sm">
            <span className="text-text-muted">Atleta:</span>{" "}
            <span className="font-semibold text-text">{athleteName}</span>
          </span>
        )}
        {isLive && (
          <Badge variant="live" dot>
            Ao Vivo
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-3">{rightSlot}</div>
    </header>
  );
}
