import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const SAMPLE = () => path.join(test.info().project.testDir, '..', '..', 'fixtures', 'sample.pdf');
const CONTROLS = 'button:visible, input:visible, [role=slider]:visible';

async function load(page: Page) {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(SAMPLE());
  await expect(page.getByTestId('word')).toBeVisible({ timeout: 20000 });
}

async function checkControls(page: Page) {
  const controls = page.locator(CONTROLS);
  const n = await controls.count();
  for (let i = 0; i < n; i++) {
    const c = controls.nth(i);
    const desc = await c.evaluate((e) => e.outerHTML.slice(0, 120));
    await expect(c, `sin nombre accesible: ${desc}`).toHaveAccessibleName(/\S/);
    const focusable = await c.evaluate((e) => {
      if ((e as HTMLButtonElement).disabled) return true;
      (e as HTMLElement).focus();
      return document.activeElement === e;
    });
    expect(focusable, `no enfocable con teclado: ${desc}`).toBe(true);
  }
  return n;
}

test.describe('[MH-33] accesibilidad', () => {
  test('[MH-33] todos los controles visibles tienen etiqueta y son enfocables (antes y después de cargar)', async ({ page }) => {
    await page.goto('/');
    await checkControls(page);
    await page.getByTestId('file-input').setInputFiles(SAMPLE());
    await expect(page.getByTestId('word')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('play')).toBeVisible();
    expect(await checkControls(page)).toBeGreaterThan(0);
  });

  test('[MH-33] la palabra lleva aria-hidden="true"', async ({ page }) => {
    await load(page);
    await expect(page.getByTestId('word')).toHaveAttribute('aria-hidden', 'true');
  });

  test('[MH-33] el botón play tiene nombre y alterna con click', async ({ page }) => {
    await load(page);
    const reader = page.getByTestId('reader');
    const play = page.getByTestId('play');
    await expect(play).toHaveAccessibleName(/\S/);
    expect(await play.evaluate((e) => e.tagName === 'BUTTON' || e.getAttribute('role') === 'button')).toBe(true);
    const start = await reader.getAttribute('data-playing');
    const other = start === 'true' ? 'false' : 'true';
    await play.click();
    await expect(reader).toHaveAttribute('data-playing', other);
    await play.click();
    await expect(reader).toHaveAttribute('data-playing', start ?? 'false');
  });
});

test.describe('[MH-33] táctil', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 667 } });

  test('[MH-33] el botón play alterna con tap', async ({ page }) => {
    await load(page);
    const reader = page.getByTestId('reader');
    const play = page.getByTestId('play');
    await expect(play).toBeVisible();
    const start = await reader.getAttribute('data-playing');
    const other = start === 'true' ? 'false' : 'true';
    await play.tap();
    await expect(reader).toHaveAttribute('data-playing', other);
    await play.tap();
    await expect(reader).toHaveAttribute('data-playing', start ?? 'false');
  });
});
