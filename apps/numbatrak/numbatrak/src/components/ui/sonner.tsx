"use client";

import { useTheme } from "next-themes@0.4.6";
import { Toaster as Sonner, ToasterProps } from "sonner@2.0.3";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--card)",
          "--success-text": "var(--foreground)",
          "--success-border": "color-mix(in srgb, var(--primary) 35%, var(--border))",
          "--error-bg": "var(--card)",
          "--error-text": "var(--destructive)",
          "--error-border": "color-mix(in srgb, var(--destructive) 35%, var(--border))",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
