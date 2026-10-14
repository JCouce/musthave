import { test, expect } from '@playwright/test';
import path from 'node:path';

const SAMPLE = () => path.join(test.info().project.testDir, '..', '..', 'fixtures', 'sample.pdf');
const core = (s: string) => s.normalize('NFC').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();

test('[MH-31] al pausar se ve el párrafo con la palabra actual resaltada', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(SAMPLE());
  const reader = page.getByTestId('reader');
  const word = page.getByTestId('word');
  await expect(word).toBeVisible({ timeout: 20000 });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  if ((await reader.getAttribute('data-playing')) === 'true') await page.keyboard.press('Space');
  await expect(reader).toHaveAttribute('data-playing', 'false');

  const before = (await word.textContent()) ?? '';
  await page.keyboard.press('Space');
  await expect(reader).toHaveAttribute('data-playing', 'true');
  await expect(word).not.toHaveText(before);
  await expect(word).toHaveText(/[\p{L}\p{N}]/u);
  await page.keyboard.press('Space');
  await expect(reader).toHaveAttribute('data-playing', 'false');

  const context = page.getByTestId('context');
  const current = context.getByTestId('context-current');
  await expect(context).toBeVisible();
  await expect(current).toBeVisible();
  await expect(current).toHaveText(/[\p{L}\p{N}]/u);

  const shown = (await word.textContent()) ?? '';
  const cur = core((await current.textContent()) ?? '');
  // Si en pausa se ve una palabra (y no una pantalla en blanco), es la resaltada; un trozo de splitLong acaba en '-'.
  if (core(shown)) {
    if (shown.trim().endsWith('-')) expect(cur).toContain(core(shown));
    else expect(cur).toBe(core(shown));
  }
  expect(core((await context.textContent()) ?? '')).toContain(cur);
});
