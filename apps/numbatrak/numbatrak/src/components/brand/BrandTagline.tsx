import { useTheme } from "next-themes";

export function BrandTagline({ className = "" }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === "light";

  return (
    <p
      className={`font-medium leading-snug ${isLight ? "text-[#0F172A]" : "text-[#10B981]"} ${className}`}
    >
      Know Your Numbers.
    </p>
  );
}
