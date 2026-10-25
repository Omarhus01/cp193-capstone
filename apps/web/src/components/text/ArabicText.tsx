import type { ReactNode } from "react";

const SIZES = {
  sm: "text-lg leading-relaxed",
  md: "text-2xl leading-loose",
  lg: "text-3xl leading-[2.6]",
};

type ArabicTextProps = {
  children: ReactNode;
  as?: "p" | "span" | "div";
  size?: keyof typeof SIZES;
  className?: string;
};

/** Every block of Arabic goes through this component so it is always right-to-left and tagged as Arabic. */
export function ArabicText({
  children,
  as: Tag = "p",
  size = "md",
  className = "",
}: ArabicTextProps) {
  return (
    <Tag dir="rtl" lang="ar" className={`font-arabic ${SIZES[size]} ${className}`}>
      {children}
    </Tag>
  );
}
