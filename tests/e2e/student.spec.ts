import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

// End-to-end tests that follow a student's study loop through the real build.

async function fresh(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/#/');
}

test('learn: open a lesson, answer its knowledge check, complete it', async ({ page }) => {
  await fresh(page);
  await page.getByRole('link', { name: /Start: / }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goto('/#/lessons/pods');
  await expect(page.getByRole('heading', { name: 'Pods', level: 1 })).toBeVisible();
  for (const s of ['What it is', 'Why it exists', 'How it works', 'Common misconceptions', 'Knowledge check', 'Official references'])
    await expect(page.getByRole('heading', { name: s, exact: true })).toBeVisible();

  const q = page.getByTestId('question-card').first();
  await q.locator('label').first().click();
  await q.getByRole('button', { name: 'Check answer' }).click();
  await expect(q.getByRole('status')).toContainText(/Correct|Not quite/);
  await expect(q.getByText('Why each option is right or wrong')).toBeVisible();

  await page.getByRole('button', { name: 'Mark lesson complete' }).click();
  await expect(page.getByRole('button', { name: /Completed/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /Completed/ })).toBeVisible();
  await page.goto('/#/');
  await expect(page.locator('.card', { hasText: 'hands-on labs done' }).getByText(/^1\/\d+$/)).toBeVisible();
});

test('ask AI: contextual question and a follow-up keep conversation history', async ({ page }) => {
  await fresh(page);
  await page.goto('/#/lessons/replicasets-and-deployments');
  await page.getByRole('button', { name: 'Ask AI about this' }).first().click();
  const drawer = page.getByRole('complementary', { name: 'AI tutor' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('Context · Lesson: ')).toBeVisible();
  await expect(drawer.getByText(/Mock tutor answer \(history=1\)/)).toBeVisible();
  await expect(drawer.getByText('Sources used')).toBeVisible();

  await drawer.getByLabel('Ask the tutor').fill('What happens if the Pod crashes?');
  await drawer.getByRole('button', { name: 'Send' }).click();
  // the follow-up arrives with the first question and answer as history
  await expect(drawer.getByText(/Mock tutor answer \(history=3\).*What happens if the Pod crashes\?/)).toBeVisible();
  await drawer.getByRole('button', { name: 'Clear conversation' }).click();
  await expect(drawer.getByText(/Mock tutor answer/)).toHaveCount(0);
});

test('AI unavailable: shows a clear state and falls back to the knowledge base', async ({ page }) => {
  await page.route('**/api/tutor/chat', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'unavailable', message: 'AI tutor is unavailable.' }) }));
  await fresh(page);
  await page.goto('/#/tutor');
  await page.getByLabel('Ask the tutor').fill('What is a Service?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'AI tutor unavailable' })).toBeVisible();
  await expect(page.getByText('From the built-in knowledge base (no AI):')).toBeVisible();
  await expect(page.getByRole('link', { name: /Service/ }).first()).toBeVisible();
});

test('quota exhausted: reports the quota state', async ({ page }) => {
  await page.route('**/api/tutor/chat', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'quota', message: 'Monthly AI request budget for this deployment is used up.' }) }));
  await fresh(page);
  await page.goto('/#/tutor');
  await page.getByLabel('Ask the tutor').fill('Explain etcd');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'budget' })).toBeVisible();
});

test('practice: terminal trainer accepts kubectl variations', async ({ page }) => {
  await fresh(page);
  await page.goto('/#/terminal?id=term-explore-cluster');
  const input = page.getByLabel('Command');
  await input.fill('kubectl get no');
  await input.press('Enter');
  await expect(page.getByText('✓ Step 1 complete')).toBeVisible();
  await input.fill('kubectl get svc');
  await input.press('Enter');
  await expect(page.getByRole('log')).toContainText('check which resource type');
  await input.fill('k get ns');
  await input.press('Enter');
  await expect(page.getByText('✓ Step 2 complete')).toBeVisible();
  await input.fill('kubectl get pods -A');
  await input.press('Enter');
  await input.fill('kubectl -n kube-system get po -o wide');
  await input.press('Enter');
  await expect(page.getByText(/All 4 steps complete/)).toBeVisible();
});

test('practice: YAML trainer validates a fixed manifest', async ({ page }) => {
  await fresh(page);
  await page.goto('/#/yaml');
  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.getByText('Some checks fail')).toBeVisible();
  await page.getByRole('button', { name: 'Show solution' }).click();
  const solution = await page.locator('pre').last().innerText();
  await page.getByLabel('Manifest').fill(solution);
  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.getByText('✓ All checks pass')).toBeVisible();
});

test('practice: troubleshooting scenario reaches a solution', async ({ page }) => {
  await fresh(page);
  await page.goto('/#/troubleshoot?id=ts-crashloopbackoff');
  for (let i = 0; i < 6; i++) {
    const next = page.getByRole('button', { name: /Next phase|Finish/ });
    if (await page.getByText(/^Resolved/).isVisible()) break;
    // try options until the correct one unlocks the next phase
    const opts = page.locator('.card button.block');
    const n = await opts.count();
    for (let j = 0; j < n && !(await next.isVisible()); j++) await opts.nth(j).click();
    await next.click();
  }
  await expect(page.getByText(/^Resolved/)).toBeVisible();
});

test('exam: take a quick mock, review mistakes, history persists after refresh', async ({ page }) => {
  await fresh(page);
  await page.goto('/#/exam');
  await page.getByRole('tab', { name: 'Quick mock' }).click();
  await page.getByRole('button', { name: /Start quick mock/ }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await expect(page.getByText('Unofficial practice question')).toBeVisible();
  // answer the first option of every question
  for (let i = 0; i < 20; i++) {
    const q = page.getByTestId('exam-question');
    const boxes = q.locator('input');
    const multi = (await boxes.first().getAttribute('type')) === 'checkbox';
    await boxes.nth(0).check();
    if (multi) await boxes.nth(1).check();
    if (i === 3) await q.getByRole('button', { name: /Flag for review/ }).click();
    if (i < 19) await q.getByRole('button', { name: 'Next →' }).click();
  }
  await page.reload(); // in-progress exam survives a refresh
  await expect(page.getByRole('timer')).toBeVisible();
  await page.getByRole('button', { name: 'Submit exam' }).click();
  await page.getByRole('button', { name: 'Yes, submit' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Result: \d+%/);
  await expect(page.getByText('By domain')).toBeVisible();
  const wrong = page.getByTestId('review-item');
  if ((await wrong.count()) > 0) await expect(wrong.first().getByRole('button', { name: 'Explain why my answer was wrong' })).toBeVisible();
  await page.getByRole('tab', { name: /Flagged \(1\)/ }).click();
  await expect(page.getByTestId('review-item')).toHaveCount(1);

  await page.reload();
  await page.goto('/#/');
  await expect(page.getByText(/short \(20q\)/)).toBeVisible();
  await page.goto('/#/readiness');
  await expect(page.getByText('Readiness checklist')).toBeVisible();
  await expect(page.getByText(/Personalised study plan/)).toBeVisible();
});

test('flashcards: review with spaced repetition', async ({ page }) => {
  await fresh(page);
  await page.goto('/#/flashcards');
  const card = page.getByTestId('flashcard');
  await card.click();
  await page.getByRole('button', { name: /Good/ }).click();
  await page.reload();
  await expect(page.getByText(/1 studied/)).toBeVisible();
});

test('progress: export, reset and import round-trip', async ({ page }) => {
  await fresh(page);
  await page.goto('/#/lessons/services');
  await page.getByRole('button', { name: 'Mark lesson complete' }).click();
  await page.goto('/#/settings');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export progress/ }).click()]);
  const file = await download.path();
  const json = JSON.parse(readFileSync(file!, 'utf8'));
  expect(json.app).toBe('kcna-interactive-lab');
  expect(Object.keys(json.progress.lessonsCompleted)).toContain('services');

  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Reset progress' }).click();
  await expect(page.getByText(/^0 lessons/)).toBeVisible();
  await page.getByTestId('import-input').setInputFiles(file!);
  await expect(page.getByRole('status')).toHaveText('Progress imported.');
  await expect(page.getByText(/^1 lessons/)).toBeVisible();
});

test('search finds lesson content', async ({ page }) => {
  await fresh(page);
  await page.getByLabel('Search lessons, glossary and labs').fill('CrashLoopBackOff');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /Search: CrashLoopBackOff/ })).toBeVisible();
  await expect(page.locator('li.card').first()).toBeVisible();
});

test('visualizers: step through the kubectl apply sequence', async ({ page }) => {
  await fresh(page);
  await page.goto('/#/explore');
  await page.getByRole('button', { name: /kube-scheduler/ }).click();
  await expect(page.getByRole('heading', { name: 'kube-scheduler' })).toBeVisible();
  await page.getByRole('tab', { name: '▶ kubectl apply' }).click();
  await page.getByRole('button', { name: 'Next →' }).click();
  await expect(page.getByText(/Step 2 of 7/)).toBeVisible();
});

test('accessibility: no serious violations on key pages', async ({ page }) => {
  await fresh(page);
  for (const path of ['/#/', '/#/lessons/pods', '/#/exam', '/#/readiness', '/#/terminal']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${path} ${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target).join(' | ')}`)).toEqual([]);
  }
});

test('responsive: mobile layout has a menu and no horizontal scroll @mobile', async ({ page }) => {
  await fresh(page);
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
  for (const path of ['/#/', '/#/lessons/services', '/#/exam', '/#/terminal']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: 'Flashcards' }).click();
  await expect(page.getByRole('heading', { name: 'Flashcards' })).toBeVisible();
});

test('phone install + spaced review: manifest served, missed questions are scheduled', async ({ page, request }) => {
  const m = await request.get('/manifest.webmanifest');
  expect(m.ok()).toBe(true);
  expect((await m.json()).display).toBe('standalone');
  expect((await request.get('/sw.js')).ok()).toBe(true);

  await fresh(page);
  await page.goto('/#/practice');
  // answer until one is wrong (pick the first choice each time)
  for (let i = 0; i < 10; i++) {
    const q = page.getByTestId('question-card');
    await q.locator('label').first().click();
    const multi = (await q.locator('input').first().getAttribute('type')) === 'checkbox';
    if (multi) await q.locator('label').nth(1).click();
    await q.getByRole('button', { name: 'Check answer' }).click();
    if (await q.getByText(/Not quite/).isVisible()) break;
    await page.getByRole('button', { name: /Next question|See results/ }).click();
  }
  await page.goto('/#/review');
  await expect(page.getByText(/[1-9]\d* question\(s\) are in your review queue/)).toBeVisible();
  await expect(page.getByRole('tab', { name: /Due today/ })).toBeVisible();
});
