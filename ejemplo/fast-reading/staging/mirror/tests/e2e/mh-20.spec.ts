import { test, expect } from '@playwright/test';
import path from 'node:path';

const SAMPLE = () => path.join(test.info().project.testDir, '..', '..', 'fixtures', 'sample.pdf');
const WIDTH = 375;
const EPS = 0.5; // redondeo subpíxel

// Regla de splitLong del contrato (reimplementada aquí a propósito; no se importa código de la app).
function splitLong(word: string): string[] {
  const alnum = word.replace(/[^\p{L}\p{N}]/gu, '').length;
  if (alnum < 14) return [word];
  if (word.includes('-')) return word.split(/(?<=-)/).filter(Boolean);
  const n = Math.ceil(word.length / 8);
  const size = Math.ceil(word.length / n);
  const parts: string[] = [];
  for (let i = 0; i < word.length; i += size) parts.push(word.slice(i, i + size));
  return parts.map((p, i) => (i < parts.length - 1 ? `${p}-` : p));
}

const CHUNKS = [
  ...splitLong('www.WholeBrainChild.com'),
  ...splitLong('lucha-huida-inmovilidad'),
  ...splitLong('MMMMMMMMMMMMM'),
];

test.use({ viewport: { width: WIDTH, height: 667 } });

test('[MH-20] los trozos más largos caben a 375 px sin desbordar', async ({ page }) => {
  expect(CHUNKS).toContain('MMMMMMMMMMMMM');
  expect(CHUNKS).toContain('inmovilidad');

  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(SAMPLE());
  const reader = page.getByTestId('reader');
  const word = page.getByTestId('word');
  await expect(word).toBeVisible({ timeout: 20000 });
  if ((await reader.getAttribute('data-playing')) === 'true') await page.getByTestId('play').click();
  await expect(reader).toHaveAttribute('data-playing', 'false');
  await page.evaluate(() => document.fonts.ready);

  for (const chunk of CHUNKS) {
    await page.evaluate((t) => (window as unknown as { __rsvp: { show(t: string): void } }).__rsvp.show(t), chunk);
    await expect(word).toHaveText(chunk);
    await page.evaluate(() => document.fonts.ready);
    const m = await word.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const t = range.getBoundingClientRect();
      const e = el.getBoundingClientRect();
      return {
        left: Math.min(t.left, e.left),
        right: Math.max(t.right, e.right),
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(m.left, `"${chunk}" se sale por la izquierda`).toBeGreaterThanOrEqual(-EPS);
    expect(m.right, `"${chunk}" se sale por la derecha`).toBeLessThanOrEqual(WIDTH + EPS);
    expect(m.scrollWidth, `"${chunk}" provoca scroll horizontal`).toBeLessThanOrEqual(WIDTH);
  }
});
