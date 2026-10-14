import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const SAMPLE = () => path.join(test.info().project.testDir, '..', '..', 'fixtures', 'sample.pdf');

// Texto de sample.pdf (ver fixtures/gen.cjs).
const SAMPLE_TEXT = [
  'CAPÍTULO UNO',
  'El cerebro del niño cambia con cada experiencia. Los padres pueden ayudar a integrar sus partes, y eso se nota en el día a día. ¿Por qué ocurre esto? Porque las conexiones se refuerzan con el uso.',
  'Cuando aparece una emoción fuerte, conviene nombrarla con calma: «¡Estás enfadado!», dijo la madre. Después, el niño pudo contar lo que había pasado, paso a paso, sin prisa.',
  'La parte de arriba del cerebro tarda años en madurar. Por eso no podemos exigir a un niño de cuatro años lo mismo que a uno de doce. Mientras tanto, nuestra tarea es acompañar.',
  'Jugar juntos fortalece la conexión. Leer un cuento antes de dormir, inventar canciones o simplemente escuchar son pequeños gestos con un efecto enorme a largo plazo.',
].join(' ');
const core = (s: string) => s.normalize('NFC').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
const VOCAB = new Set(SAMPLE_TEXT.split(/\s+/).map(core).filter(Boolean));

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

test('[MH-15] al recargar se abre solo el último libro, sin volver a elegir archivo', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(SAMPLE());
  await expect(page.getByTestId('word')).toBeVisible({ timeout: 20000 });
  await waitForPersisted(page);

  await page.reload();
  const reader = page.getByTestId('reader');
  const word = page.getByTestId('word');
  await expect(word).toBeVisible({ timeout: 20000 });

  // El libro está cargado de verdad: al reproducir, las palabras son de sample.pdf.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  if ((await reader.getAttribute('data-playing')) !== 'true') await page.keyboard.press('Space');
  await expect(reader).toHaveAttribute('data-playing', 'true');
  await expect(word).toHaveText(/[\p{L}\p{N}]/u);
  const shown = core((await word.textContent()) ?? '');
  expect([...VOCAB].some((v) => v.startsWith(shown) || v === shown), `"${shown}" no es de sample.pdf`).toBe(true);
});
