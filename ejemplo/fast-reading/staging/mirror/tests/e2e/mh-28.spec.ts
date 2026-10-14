import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const SAMPLE = () => path.join(test.info().project.testDir, '..', '..', 'fixtures', 'sample.pdf');

async function loadPaused(page: Page) {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(SAMPLE());
  await expect(page.getByTestId('word')).toBeVisible({ timeout: 20000 });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const reader = page.getByTestId('reader');
  if ((await reader.getAttribute('data-playing')) === 'true') await page.keyboard.press('Space');
  await expect(reader).toHaveAttribute('data-playing', 'false');
}

const pressN = async (page: Page, key: string, n: number) => {
  for (let i = 0; i < n; i++) await page.keyboard.press(key);
};

test('[MH-28] ↑/↓ cambian 25 WPM entre 100 y 1000, por defecto 300', async ({ page }) => {
  await loadPaused(page);
  const wpm = page.getByTestId('wpm');
  await expect(wpm).toHaveText(/^\s*300\s*$/);
  await page.keyboard.press('ArrowUp');
  await expect(wpm).toHaveText(/^\s*325\s*$/);
  await pressN(page, 'ArrowDown', 2);
  await expect(wpm).toHaveText(/^\s*275\s*$/);
  await pressN(page, 'ArrowUp', 40);
  await expect(wpm).toHaveText(/^\s*1000\s*$/);
  await pressN(page, 'ArrowDown', 45);
  await expect(wpm).toHaveText(/^\s*100\s*$/);
});

test('[MH-28] Espacio alterna play/pausa', async ({ page }) => {
  await loadPaused(page);
  const reader = page.getByTestId('reader');
  await page.keyboard.press('Space');
  await expect(reader).toHaveAttribute('data-playing', 'true');
  await page.keyboard.press('Space');
  await expect(reader).toHaveAttribute('data-playing', 'false');
});

test('[MH-28] con el foco en el botón play, Espacio actúa una sola vez', async ({ page }) => {
  await loadPaused(page);
  const reader = page.getByTestId('reader');

  // Cuenta cambios reales de data-playing para detectar un doble disparo (keydown + click del botón en keyup).
  await reader.evaluate((el) => {
    const w = window as unknown as { __playingChanges: number };
    w.__playingChanges = 0;
    new MutationObserver((recs) => {
      for (const r of recs) if (r.oldValue !== el.getAttribute('data-playing')) w.__playingChanges++;
    }).observe(el, { attributes: true, attributeFilter: ['data-playing'], attributeOldValue: true });
  });

  await page.getByTestId('play').focus();
  await expect(page.getByTestId('play')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(reader).toHaveAttribute('data-playing', 'true');
  // Deja asentar los handlers diferidos (dos frames) antes de la aserción final.
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  await expect(reader).toHaveAttribute('data-playing', 'true');
  expect(await page.evaluate(() => (window as unknown as { __playingChanges: number }).__playingChanges)).toBe(1);
});
