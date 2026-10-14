import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

// testDir = <repo>/.oracle/tests/e2e → fixtures en <repo>/.oracle/fixtures (vale en ESM y CJS).
const SAMPLE = () => path.join(test.info().project.testDir, '..', '..', 'fixtures', 'sample.pdf');

// Cualquier recurso de pdf.js: chunk con "pdf" en el nombre (pdf-<hash>.js, pdf.worker.min-<hash>.mjs) o ruta con "pdfjs".
const isPdfJsUrl = (url: string): boolean => {
  if (url.startsWith('data:') || url.startsWith('blob:')) return false;
  const { pathname } = new URL(url);
  const base = pathname.split('/').pop() ?? '';
  return /pdfjs/i.test(pathname) || (/pdf/i.test(base) && /\.m?js$/i.test(base));
};

// Suma de registros en todas las bases de IndexedDB del origen.
const idbRecordCount = (page: Page) =>
  page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    let total = 0;
    for (const info of dbs) {
      if (!info.name) continue;
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open(info.name as string);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      for (const store of Array.from(db.objectStoreNames)) {
        total += await new Promise<number>((res, rej) => {
          const r = db.transaction(store, 'readonly').objectStore(store).count();
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
      }
      db.close();
    }
    return total;
  });

// Espera a que el libro esté persistido: hay registros y el recuento no cambia entre dos sondeos.
async function waitForPersisted(page: Page) {
  let prev = -1;
  await expect
    .poll(
      async () => {
        const n = await idbRecordCount(page);
        const stable = n > 0 && n === prev;
        prev = n;
        return stable;
      },
      { timeout: 15000, intervals: [300] },
    )
    .toBe(true);
}

test('[MH-14] al reabrir un libro cacheado no se crea ningún Worker ni se carga pdf.js', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(SAMPLE());
  await expect(page.getByTestId('word')).toBeVisible({ timeout: 20000 });
  await page.waitForLoadState('networkidle');
  await waitForPersisted(page);

  await page.addInitScript(() => {
    const w = window as unknown as { __workers: number; Worker: typeof Worker };
    w.__workers = 0;
    const Native = window.Worker;
    w.Worker = class extends Native {
      constructor(url: string | URL, opts?: WorkerOptions) {
        w.__workers++;
        super(url, opts);
      }
    };
  });

  const pdfRequests: string[] = [];
  page.on('request', (req) => {
    if (isPdfJsUrl(req.url())) pdfRequests.push(req.url());
  });

  await page.reload();
  const reader = page.getByTestId('reader');
  const word = page.getByTestId('word');
  await expect(word).toBeVisible({ timeout: 20000 });

  // Demuestra que el libro se ha abierto de verdad (desde caché): se puede reproducir y pinta palabras.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  if ((await reader.getAttribute('data-playing')) !== 'true') await page.keyboard.press('Space');
  await expect(reader).toHaveAttribute('data-playing', 'true');
  await expect(word).toHaveText(/[\p{L}\p{N}]/u);
  await page.keyboard.press('Space');
  await expect(reader).toHaveAttribute('data-playing', 'false');
  await page.waitForLoadState('networkidle');

  expect(await page.evaluate(() => (window as unknown as { __workers: number }).__workers)).toBe(0);
  expect(pdfRequests).toEqual([]);
  expect(await page.evaluate(() => typeof (globalThis as { pdfjsLib?: unknown }).pdfjsLib)).toBe('undefined');
});
