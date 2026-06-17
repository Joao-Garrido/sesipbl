// Reuso 1:1 do Vinlet (clinic-saas/src/shared/components/Card.tsx)
import { type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  headerRight?: ReactNode;
  hoverable?: boolean;
  noPadding?: boolean;
}

export function Card({
  children,
  className = "",
  title,
  headerRight,
  hoverable = false,
  noPadding = false,
}: CardProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-border shadow-sm ${hoverable ? "hover:shadow-md hover:border-gray-200 transition-all duration-200" : ""} ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-text">{title}</h3>
          {headerRight}
        </div>
      )}
      <div className={noPadding ? "" : "p-5"}>{children}</div>
    </div>
  );
}
