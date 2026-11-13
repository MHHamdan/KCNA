# Exam readiness algorithm

The **Am I ready?** page shows a 0–100 *preparation indicator*. It is a transparent, conservative heuristic. It is **not** a statistically validated probability of passing, because there is no outcome data to calibrate it against. The code is in `packages/engine/src/readiness.ts`.

## 1. Objective mastery (per competency)

- Each answered question is evidence. Weight `w = 0.5^(age_days / 21)` (half-life of 21 days), multiplied by 0.8 for review re-answers.
- Start from a Beta(1, 1) prior. Add the weighted correct answers to α and the weighted incorrect answers to β.
- Report the **lower estimate** = posterior mean − one posterior standard deviation.

Two lucky answers give a mean of 75% but a lower estimate near 50%. Forty correct answers give a lower estimate above 90%. Old evidence fades, so the indicator rewards retention, not cramming.

## 2. Components

| Component | Weight | Definition |
|---|---:|---|
| Knowledge K | 0.40 | Σ over domains of exam weight × mean lower-estimate mastery of its competencies |
| Mocks M | 0.35 | Mean score of up to 3 **full** mock exams in the last 30 days. If none exists, quick mocks count at half value. |
| Coverage C | 0.15 | Per competency, min(1, distinct questions answered / 6), weighted by exam weight |
| Retention R | 0.10 | Share of studied flashcards with an interval of 7+ days, minus a lapse penalty |

`index = 100 × (0.40·K + 0.35·M + 0.15·C + 0.10·R − inconsistency)`. The inconsistency penalty is `min(0.10, max(0, σ_mocks − 0.05))`, so erratic mock results cost up to 10 points.

## 3. Status gates

| Status | Rule |
|---|---|
| Not started | No answers yet |
| Building | Default |
| Approaching | index ≥ 60 **and** mock mean ≥ 70% |
| Ready | index ≥ 80 **and** ≥ 2 full mocks in 30 days averaging ≥ 80% **and** every domain ≥ 65% lower-estimate mastery **and** coverage ≥ 85% |

Completing lessons never changes the index on its own; a unit test enforces this. The 80% mock bar is 5 points above the 75% practice pass mark, which leaves a margin for exam-day variance and question differences.

## 4. Weakness diagnosis and study plan

- **Demonstrated weaknesses** (≥ 5 answers with mean < 65%) rank first. The rest are ranked by *expected exam points lost* = competency weight × (1 − lower mastery).
- **Repeated mistakes** are questions missed at least twice and not answered correctly since.
- The study plan combines, in order: the next lesson in the path (if fewer than 10 answers), the lesson, hands-on practice and 10 questions for the top two weak competencies, then repeated mistakes, due flashcards, a matching full lab, and a full mock if the last one is older than 7 days.
- The tutor's **Revision mode** receives a compact text summary of this analysis (`performanceSummary`), so it can explain *why* a topic is recommended.

## 5. Mock exams

- `selectExamQuestions` splits the question count across domains by exam weight, using the largest-remainder method (60 questions → 26/17/10/7). It never repeats a question. If a domain pool runs short, it tops up from the other domains. Up to 25% of each domain's picks favour questions the learner recently got wrong.
- Scoring is all-or-nothing per question (multi-select answers must match exactly).
- All questions are original and labelled unofficial.
