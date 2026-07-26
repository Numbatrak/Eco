import { NumbatrakSymbolMark } from "./NumbatrakSymbolMark";

type LogoSize = "sm" | "md" | "lg";
type LogoVariant = "onDark" | "onLight";

const sizeMap: Record<LogoSize, { mark: number; wordClass: string; gap: string }> = {
  sm: { mark: 24, wordClass: "text-sm", gap: "gap-2" },
  md: { mark: 32, wordClass: "text-lg", gap: "gap-2.5" },
  lg: { mark: 40, wordClass: "text-2xl", gap: "gap-3" },
};

export function NumbatrakLogo({
  size = "md",
  variant = "onDark",
  showWordmark = true,
  className = "",
}: {
  size?: LogoSize;
  variant?: LogoVariant;
  showWordmark?: boolean;
  className?: string;
}) {
  const { mark, wordClass, gap } = sizeMap[size];
  const trakClass = variant === "onDark" ? "text-white" : "text-[#0F172A]";

  if (!showWordmark) {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <NumbatrakSymbolMark size={mark} />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center ${gap} ${className}`}>
      <NumbatrakSymbolMark size={mark} />
      <span
        className={`font-sans font-extrabold tracking-tight ${wordClass}`}
        style={{ letterSpacing: "-0.04em" }}
      >
        <span className="bg-gradient-to-r from-[#10B981] to-[#34D399] bg-clip-text text-transparent">
          Numba
        </span>
        <span className={trakClass}>trak</span>
      </span>
    </div>
  );
}
