import type { ReactNode } from "react";

type ArabicTextProps = {
  children: ReactNode;
  as?: "p" | "span" | "div";
  className?: string;
};

/** Every block of Arabic goes through this component so it is always right-to-left and tagged as Arabic. */
export function ArabicText({ children, as: Tag = "p", className = "" }: ArabicTextProps) {
  return (
    <Tag dir="rtl" lang="ar" className={`font-arabic text-2xl leading-loose ${className}`}>
      {children}
    </Tag>
  );
}
