import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ingest } from '@/ingest/ingest';
import type { IngestResult } from '@/ingest/ingest';

const FIXTURES = process.env.FIXTURES ?? '';
const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(path.join(FIXTURES, name)));

function expectError(res: IngestResult, code: string): void {
  expect(res.ok).toBe(false);
  if (res.ok) return;
  expect(res.error.code).toBe(code);
  expect(typeof res.error.message).toBe('string');
  expect(res.error.message.trim().length).toBeGreaterThan(0);
}

describe('[MH-2] errores claros de ingesta con el extractor por defecto', () => {
  it('[MH-2] PDF sin texto → NO_TEXT', async () => {
    expectError(await ingest(fixture('notext.pdf')), 'NO_TEXT');
  });

  it('[MH-2] PDF cifrado con contraseña de usuario → ENCRYPTED', async () => {
    expectError(await ingest(fixture('encrypted.pdf')), 'ENCRYPTED');
  });

  it('[MH-2] PDF corrupto (cabecera válida, cuerpo basura) → CORRUPT', async () => {
    expectError(await ingest(fixture('corrupt.pdf')), 'CORRUPT');
  });
});

describe('[MH-2] fallos del extractor: nunca rechaza ni se cuelga', () => {
  it('[MH-2] extractor que rechaza con un Error genérico → WORKER_CRASH', async () => {
    const extractor = vi.fn(() => Promise.reject(new Error('el worker ha petado')));
    const res = await ingest(fixture('sample.pdf'), { extractor });
    expect(extractor).toHaveBeenCalledTimes(1);
    expectError(res, 'WORKER_CRASH');
  });

  it('[MH-2] extractor que lanza de forma síncrona → WORKER_CRASH, sin rechazar', async () => {
    const extractor = vi.fn((): never => {
      throw new Error('boom');
    });
    const res = await ingest(fixture('sample.pdf'), { extractor });
    expectError(res, 'WORKER_CRASH');
  });

  it('[MH-2] extractor que nunca resuelve con timeoutMs 200 → TIMEOUT en < 2 s', async () => {
    const extractor = vi.fn(() => new Promise<never>(() => {}));
    const t0 = Date.now();
    const res = await ingest(fixture('sample.pdf'), { extractor, timeoutMs: 200 });
    const elapsed = Date.now() - t0;
    expectError(res, 'TIMEOUT');
    expect(elapsed).toBeLessThan(2000);
  }, 5000);

  it('[MH-2] ingest resuelve (no rechaza) en todos los casos de error', async () => {
    const cases: Promise<IngestResult>[] = [
      ingest(new Uint8Array(0)),
      ingest(fixture('notext.pdf')),
      ingest(fixture('encrypted.pdf')),
      ingest(fixture('corrupt.pdf')),
      ingest(fixture('imagen-con-extension.pdf')),
      ingest(fixture('sample.pdf'), { extractor: () => Promise.reject(new TypeError('x')) }),
      ingest(fixture('sample.pdf'), { extractor: () => new Promise<never>(() => {}), timeoutMs: 100 }),
    ];
    const settled = await Promise.allSettled(cases);
    for (const s of settled) {
      expect(s.status).toBe('fulfilled');
      if (s.status === 'fulfilled') expect(s.value.ok).toBe(false);
    }
  });
});
