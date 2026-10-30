import { Fragment, type ReactNode } from 'react';
import { useRouter } from '@tanstack/react-router';

import { cn } from '@/lib/utils';

/** Vertex pages an answer may link to; anything else shows as plain text. */
const INTERNAL = /^\/(campuses|insights|s\/[\w.-]+|resources)?(\?[^\s)]*)?$/;

/** **bold**, *italic*, `code` and [links](/vertex/page), as React elements (never raw HTML). */
function Inline({ text }: { text: string }) {
  const router = useRouter();
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\)|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    if (match.index! > last) parts.push(text.slice(last, match.index));
    if (token.startsWith('**')) {
      parts.push(<strong key={parts.length}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('[')) {
      const [, label, href] = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!;
      parts.push(
        INTERNAL.test(href) ? (
          <a
            key={parts.length}
            href={href}
            onClick={(event) => {
              event.preventDefault();
              router.history.push(href);
            }}
            className="text-brand-700 dark:text-brand-300 font-semibold underline-offset-2 hover:underline"
          >
            {label}
          </a>
        ) : (
          label
        )
      );
    } else if (token.startsWith('`')) {
      parts.push(
        <code key={parts.length} className="rounded bg-slate-100 px-1 text-[0.85em]">
          {token.slice(1, -1)}
        </code>
      );
    } else {
      parts.push(<em key={parts.length}>{token.slice(1, -1)}</em>);
    }
    last = match.index! + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

/**
 * The small part of Markdown that Ask Vertex answers use: paragraphs, headings, bullet and
 * numbered lists, tables, bold, italic, code and links.
 */
export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: ReactNode[] = [];
  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        if (!/^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i])) rows.push(cells(lines[i]));
        i++;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div key={blocks.length} className="-mx-1 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                {head.map((cell, index) => (
                  <th
                    key={index}
                    className="px-1.5 py-1 font-semibold whitespace-nowrap text-slate-500"
                  >
                    <Inline text={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-slate-100 last:border-0">
                  {row.map((cell, index) => (
                    <td key={index} className="px-1.5 py-1 align-top tabular-nums">
                      <Inline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }
    const bullet = /^\s*[-*•]\s+/;
    const numbered = /^\s*\d+[.)]\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? numbered : bullet).test(lines[i])) {
        items.push(lines[i].replace(ordered ? numbered : bullet, ''));
        i++;
      }
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List
          key={blocks.length}
          className={cn('space-y-1 pl-5', ordered ? 'list-decimal' : 'list-disc')}
        >
          {items.map((item, index) => (
            <li key={index}>
              <Inline text={item} />
            </li>
          ))}
        </List>
      );
      continue;
    }
    const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
    blocks.push(
      <p key={blocks.length} className={cn(heading && 'font-bold')}>
        <Inline text={heading ? heading[1] : line} />
      </p>
    );
    i++;
  }
  return (
    <div className={cn('space-y-2 text-sm leading-relaxed', className)}>
      {blocks.map((block, index) => (
        <Fragment key={index}>{block}</Fragment>
      ))}
    </div>
  );
}
