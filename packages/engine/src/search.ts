// Lightweight BM25 full-text index. Used for site search, the offline tutor
// fallback and server-side retrieval (RAG) — no vector database needed for a
// corpus of a few hundred authored documents.

export interface SearchDoc {
  id: string;
  kind: 'lesson' | 'section' | 'faq' | 'glossary' | 'comparison' | 'question' | 'lab' | 'flashcard';
  title: string;
  text: string;
  /** in-app route, e.g. #/lessons/pods */
  href: string;
  lessonId?: string;
  objective?: string;
  /** official references attached to the source item */
  refs?: { title: string; url: string }[];
}

export interface SearchHit {
  doc: SearchDoc;
  score: number;
}

const STOP = new Set(
  'a an and are as at be but by can do does for from how i if in into is it its me my of on or so than that the their them then there these they this to was what when where which who why will with you your'.split(
    ' ',
  ),
);

/** Keep k8s-ish tokens intact: "kube-proxy", "configmap", "1.27", "crashloopbackoff". */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[`*_#>()[\]{}"',;:!?|=]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[.-]+|[.-]+$/g, ''))
    .filter((t) => t.length > 1 && !STOP.has(t))
    .flatMap((t) => (t.includes('-') || t.includes('/') ? [t, ...t.split(/[-/]/).filter((p) => p.length > 1)] : [t]))
    .map(stem);
}

/** Tiny suffix stemmer: pods→pod, policies→policy, services→service. */
function stem(t: string): string {
  if (t.length > 4 && t.endsWith('ies')) return t.slice(0, -3) + 'y';
  if (t.length > 3 && t.endsWith('es') && /(ss|x|ch|sh)es$/.test(t)) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') && !t.endsWith('us')) return t.slice(0, -1);
  return t;
}

const KIND_BOOST: Record<SearchDoc['kind'], number> = {
  lesson: 1.3,
  section: 1.0,
  faq: 1.0,
  glossary: 1.2,
  comparison: 1.15,
  question: 0.8,
  lab: 0.9,
  flashcard: 0.85,
};

export class SearchIndex {
  private docs: SearchDoc[] = [];
  private tf: Map<string, number>[] = [];
  private titleTokens: Set<string>[] = [];
  private len: number[] = [];
  private df = new Map<string, number>();
  private avgLen = 0;

  constructor(docs: SearchDoc[]) {
    for (const d of docs) this.add(d);
    this.avgLen = this.len.reduce((a, b) => a + b, 0) / Math.max(1, this.len.length);
  }

  private add(doc: SearchDoc) {
    const tokens = tokenize(`${doc.title} ${doc.title} ${doc.text}`);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    this.docs.push(doc);
    this.tf.push(tf);
    this.titleTokens.push(new Set(tokenize(doc.title)));
    this.len.push(tokens.length);
  }

  get size() {
    return this.docs.length;
  }

  search(query: string, opts: { limit?: number; kinds?: SearchDoc['kind'][]; boostLesson?: string } = {}): SearchHit[] {
    const q = [...new Set(tokenize(query))];
    if (!q.length) return [];
    const N = this.docs.length;
    const k1 = 1.4;
    const b = 0.75;
    const hits: SearchHit[] = [];
    for (let i = 0; i < N; i++) {
      const doc = this.docs[i];
      if (opts.kinds && !opts.kinds.includes(doc.kind)) continue;
      const tf = this.tf[i];
      let score = 0;
      let matched = 0;
      for (const term of q) {
        const f = tf.get(term);
        if (!f) continue;
        matched++;
        const df = this.df.get(term) ?? 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * this.len[i]) / this.avgLen)));
        if (this.titleTokens[i].has(term)) score += idf * 0.6;
      }
      if (!score) continue;
      // reward documents that cover more of the query
      score *= KIND_BOOST[doc.kind] * (0.6 + (0.4 * matched) / q.length);
      if (opts.boostLesson && doc.lessonId === opts.boostLesson) score *= 1.5;
      hits.push({ doc, score });
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, opts.limit ?? 10);
  }
}
