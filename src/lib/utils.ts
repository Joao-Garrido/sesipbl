// Reuso do Vinlet — concat util com filter falsy
export function cn(...args: (string | undefined | null | false)[]): string {
  return args.filter(Boolean).join(" ");
}
