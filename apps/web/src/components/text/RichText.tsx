import { Fragment, type ReactNode } from "react";
import { parseParagraphs } from "@/lib/services/reading/inline-format";

type RichTextProps = {
  text: string;
  /** Shown at the start of the first paragraph, such as a related verse's reference. */
  lead?: ReactNode;
  /** Shown at the end of the last paragraph, such as the point's source links. */
  trailing?: ReactNode;
  className?: string;
  lang?: string;
};

/**
 * Content text with **bold**, *italic* and paragraphs, rendered as elements (never as HTML), so
 * nothing in the content can inject markup.
 */
export function RichText({ text, lead, trailing, className = "", lang }: RichTextProps) {
  const paragraphs = parseParagraphs(text);
  return paragraphs.map((tokens, i) => (
    <p key={i} lang={lang} className={`leading-7 ${i > 0 ? "mt-3" : ""} ${className}`}>
      {lead && i === 0 ? lead : null}
      {tokens.map((token, j) => {
        const content = token.italic ? <em>{token.text}</em> : token.text;
        return (
          <Fragment key={j}>
            {token.bold ? <strong className="font-semibold">{content}</strong> : content}
          </Fragment>
        );
      })}
      {trailing && i === paragraphs.length - 1 ? <> {trailing}</> : null}
    </p>
  ));
}
