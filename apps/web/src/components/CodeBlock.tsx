import { useState, type ReactNode } from 'react';

// Minimal, dependency-free highlighter for YAML and shell — enough to make
// manifests readable without shipping a full grammar engine.

function highlightYaml(line: string, key: number): ReactNode {
  const com = line.indexOf(' #');
  const [body, comment] = line.trimStart().startsWith('#') ? ['', line] : com >= 0 ? [line.slice(0, com), line.slice(com)] : [line, ''];
  const m = body.match(/^(\s*-?\s*)([\w.\-/]+)(:)(.*)$/);
  let main: ReactNode = body;
  if (m) {
    const v = m[4];
    const vt = v.trim();
    const cls = /^["']/.test(vt) ? 'tok-str' : /^-?\d+(\.\d+)?$|^(true|false|null)$/.test(vt) ? 'tok-num' : vt ? 'tok-str' : '';
    main = (
      <>
        {m[1]}
        <span className="tok-key">{m[2]}</span>
        {m[3]}
        {cls ? <span className={cls}>{v}</span> : v}
      </>
    );
  }
  return (
    <span key={key}>
      {main}
      {comment && <span className="tok-com">{comment}</span>}
      {'\n'}
    </span>
  );
}

function highlightShell(line: string, key: number): ReactNode {
  if (line.trimStart().startsWith('#'))
    return (
      <span key={key} className="tok-com">
        {line + '\n'}
      </span>
    );
  const m = line.match(/^(\s*\$?\s*)(kubectl|kind|minikube|helm|docker|curl|nslookup|k|echo|cat|watch)(\b.*)$/);
  if (!m) return <span key={key}>{line + '\n'}</span>;
  return (
    <span key={key}>
      {m[1]}
      <span className="tok-cmd">{m[2]}</span>
      {m[3].split(/(\s--?[\w-]+=?)/).map((part, i) => (/^\s--?[\w-]+=?$/.test(part) ? <span key={i} className="tok-key">{part}</span> : part))}
      {'\n'}
    </span>
  );
}

export function CodeBlock({ code, language, title }: { code: string; language?: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const lang = language || (/^\s*(apiVersion|kind):/m.test(code) ? 'yaml' : /^\s*\$?\s*(kubectl|kind|helm)\b/m.test(code) ? 'bash' : 'text');
  const lines = code.replace(/\n$/, '').split('\n');
  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-ink-950">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-800">
        <span>{title ?? lang}</span>
        <button
          type="button"
          className="rounded px-1.5 py-0.5 hover:bg-slate-200 dark:hover:bg-ink-800"
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            });
          }}
          aria-label="Copy code"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed">
        <code>
          {lines.map((l, i) => (lang === 'yaml' || lang === 'yml' ? highlightYaml(l, i) : lang === 'bash' || lang === 'sh' || lang === 'shell' ? highlightShell(l, i) : <span key={i}>{l + '\n'}</span>))}
        </code>
      </pre>
    </div>
  );
}
