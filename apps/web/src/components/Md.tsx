import { Fragment, type ReactNode } from 'react';
import { CodeBlock } from './CodeBlock';

// Safe renderer for the small Markdown subset used by authored content and by
// the AI tutor. It builds React elements (never innerHTML), so model output
// cannot inject markup. Links are only rendered for http(s) URLs.

function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\((https?:\/\/[^)\s]+)\))|(\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = key;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<code key={i++}>{m[1].slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={i++}>{m[2].slice(2, -2)}</strong>);
    else if (m[3])
      out.push(
        <a key={i++} href={m[4]} target="_blank" rel="noopener noreferrer">
          {m[3].slice(1, m[3].indexOf(']'))}
        </a>,
      );
    else if (m[5]) out.push(<em key={i++}>{m[5].slice(1, -1)}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { t: 'p'; text: string }
  | { t: 'ul' | 'ol'; items: string[] }
  | { t: 'code'; lang: string; text: string }
  | { t: 'h'; text: string };

export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r/g, '').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ t: 'p', text: para.join(' ') });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```(\w*)/);
    if (fence) {
      flush();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      blocks.push({ t: 'code', lang: fence[1], text: body.join('\n') });
      continue;
    }
    const li = line.match(/^\s*[-*]\s+(.*)/);
    const oli = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (li || oli) {
      flush();
      const t = li ? 'ul' : 'ol';
      const prev = blocks[blocks.length - 1];
      const item = (li ?? oli)![1];
      if (prev && prev.t === t) prev.items.push(item);
      else blocks.push({ t, items: [item] });
      continue;
    }
    const h = line.match(/^#{1,4}\s+(.*)/);
    if (h) {
      flush();
      blocks.push({ t: 'h', text: h[1] });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    // continuation of a list item
    const prev = blocks[blocks.length - 1];
    if (!para.length && prev && (prev.t === 'ul' || prev.t === 'ol') && /^\s{2,}/.test(line)) {
      prev.items[prev.items.length - 1] += ' ' + line.trim();
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}

export function Md({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`prose-k ${className}`}>
      {parseBlocks(children).map((b, i) => {
        if (b.t === 'p') return <p key={i}>{inline(b.text)}</p>;
        if (b.t === 'h') return <p key={i} className="font-semibold">{inline(b.text)}</p>;
        if (b.t === 'code') return <CodeBlock key={i} code={b.text} language={b.lang} />;
        const L = b.t;
        return (
          <L key={i}>
            {b.items.map((it, j) => (
              <li key={j}>
                <Fragment>{inline(it)}</Fragment>
              </li>
            ))}
          </L>
        );
      })}
    </div>
  );
}

export function MdInline({ children }: { children: string }) {
  return <>{inline(children)}</>;
}
