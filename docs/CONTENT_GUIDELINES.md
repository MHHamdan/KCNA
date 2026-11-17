# Content guidelines

All content lives in `packages/content/src` as typed data (schema: `types.ts`). Run `npm test` after any change: the content test suite rejects malformed or low-quality items.

## Standards

- **Correct for current Kubernetes (v1.30+).** Examples: dockershim was removed in 1.24. PodSecurityPolicy was removed in 1.25 (Pod Security Admission replaces it). Gateway API is GA. Secrets are base64-encoded, not encrypted, by default. `kubectl run` creates a Pod.
- **Never invent** kubectl flags, API fields or URLs. `npm run check:links` verifies every reference URL.
- **Original only.** Never reproduce real exam questions or "dumps".
- **Scope labels.** Use `scope: 'foundation' | 'kcna' | 'beyond'` and the lesson `deeper` field for optional detail.
- **Markdown subset** in `Md` fields: paragraphs, `**bold**`, `` `code` ``, `- ` lists, fenced code blocks. Put links in `references`, not inline.

## Adding a lesson

1. Add a `Lesson` object to `lessons/a.ts`, `b.ts` or `c.ts`, or to a new file wired into `index.ts`.
2. Fill every section: what, why, problem, how, components, misconceptions, example, exercise, FAQ, key terms and references. Add `diagram` if one of the `DiagramId`s fits.
3. Add at least 2 questions with `lessonId` set to the new lesson. The knowledge check is derived from these.
4. Run `npm test` and `npm run coverage:matrix`.

## Adding a question

- ID `q-<objective>-NNN`, unique. `domain` must match the objective's domain.
- 4 choices (sometimes 5), plausible distractors, no "all/none of the above", and a correct-answer position that varies.
- `type: 'multi'` must say "Select TWO" (or the right number) in the prompt.
- `explanation` (2–4 sentences) plus a `choiceRationale` entry for every choice. These feed the review screens and the tutor's "Explain why my answer was wrong".
- One or two official `references`.

## Adding a lab

- `status: 'full'` means a complete walkthrough with expected output; `'design'` means an outline. Full labs are executed on a real kind cluster by `.github/workflows/labs.yml` (weekly and on every change to `labs.ts`) using `scripts/run-labs.ts`, which runs every command in one shell session, time-boxes watches, skips port-forward, and accepts errors the lab itself lists as expected. Expected outputs remain approximate (names, ages, IPs differ).
- Re-check CNCF maturity claims with `npm run check:ecosystem`.
- Every lab needs objective, prerequisites, architecture, tasks (commands + expected output + hints), validation, troubleshooting, cleanup and references.
- Labs run on the learner's machine. Never wire the app to execute commands against a real cluster.

## Adding practice items

- **Terminal**: `KubectlExpectation`s use canonical resource names and long flag names. Keep expectations minimal so reasonable variations pass. A test builds a canonical command for each expectation and checks that it matches.
- **YAML**: single-document manifests. The `starter` must fail at least one check and the `solution` must pass every check. Both are tested.
- **Troubleshooting**: hypothesis → investigation → evidence → solution, with exactly one correct option per stage and feedback for every option.
