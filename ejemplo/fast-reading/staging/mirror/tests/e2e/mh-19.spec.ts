import { test, expect } from '@playwright/test';
import path from 'node:path';

const SAMPLE = () => path.join(test.info().project.testDir, '..', '..', 'fixtures', 'sample.pdf');

const CASES: Array<[string, string]> = [
  ['a', 'a'],
  ['cerebro', 'r'],
  ['–Hasta', 'a'],
  ['«¿Hoy', 'o'],
];

test('[MH-19] la letra pivote cae en la misma x (±1 px) para palabras con y sin puntuación de apertura', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(SAMPLE());
  const reader = page.getByTestId('reader');
  const word = page.getByTestId('word');
  const pivot = word.getByTestId('pivot');
  await expect(word).toBeVisible({ timeout: 20000 });
  if ((await reader.getAttribute('data-playing')) === 'true') await page.getByTestId('play').click();
  await expect(reader).toHaveAttribute('data-playing', 'false');
  await page.evaluate(() => document.fonts.ready);

  const lefts: number[] = [];
  const centers: number[] = [];
  for (const [w, letter] of CASES) {
    await page.evaluate((t) => (window as unknown as { __rsvp: { show(t: string): void } }).__rsvp.show(t), w);
    await expect(word).toHaveText(w);
    await expect(pivot).toHaveText(letter);
    await page.evaluate(() => document.fonts.ready);
    const box = await pivot.boundingBox();
    expect(box, `pivot sin caja para "${w}"`).not.toBeNull();
    lefts.push(box!.x);
    centers.push(box!.x + box!.width / 2);
  }

  // Vale anclar el pivote por su borde izquierdo o por su centro, pero el mismo criterio para las cuatro.
  const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
  const best = Math.min(spread(lefts), spread(centers));
  expect(best, `lefts=${lefts.join(',')} centers=${centers.join(',')}`).toBeLessThanOrEqual(1);
});
