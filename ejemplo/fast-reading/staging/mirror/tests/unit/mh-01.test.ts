import { describe, it, expect, vi } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isPdf } from '@/ingest/validate';
import { ingest } from '@/ingest/ingest';
import type { Book } from '@/core/types';

const FIXTURES = process.env.FIXTURES ?? '';
const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(path.join(FIXTURES, name)));
const ascii = (s: string): Uint8Array => new TextEncoder().encode(s);
const fakeBook: Book = { words: ['hola', 'mundo.'], paragraphStarts: [0], titles: [], pageCount: 1 };

describe('[MH-1] isPdf valida por cabecera %PDF-, no por extensión', () => {
  it('[MH-1] acepta bytes que empiezan por %PDF-', () => {
    expect(isPdf(ascii('%PDF-1.7\n%âãÏÓ\n1 0 obj\n'))).toBe(true);
    expect(isPdf(ascii('%PDF-'))).toBe(true);
  });

  it('[MH-1] rechaza un PNG', () => {
    expect(isPdf(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]))).toBe(false);
  });

  it('[MH-1] rechaza entrada vacía o demasiado corta', () => {
    expect(isPdf(new Uint8Array(0))).toBe(false);
    expect(isPdf(ascii('%PDF'))).toBe(false);
  });

  it('[MH-1] rechaza texto plano y cabeceras desplazadas', () => {
    expect(isPdf(ascii('hola, esto es un archivo de texto'))).toBe(false);
    expect(isPdf(ascii(' %PDF-1.7'))).toBe(false);
    expect(isPdf(ascii('%pdf-1.7'))).toBe(false);
  });

  it('[MH-1] acepta un PDF real guardado con extensión .txt', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'mh01-'));
    const file = path.join(dir, 'libro.txt');
    writeFileSync(file, readFileSync(path.join(FIXTURES, 'sample.pdf')));
    expect(isPdf(new Uint8Array(readFileSync(file)))).toBe(true);
  });

  it('[MH-1] rechaza un PNG guardado con extensión .pdf', () => {
    expect(isPdf(fixture('imagen-con-extension.pdf'))).toBe(false);
  });
});

describe('[MH-1] ingest rechaza lo que no es PDF sin romper', () => {
  it('[MH-1] imagen-con-extension.pdf → NOT_PDF y no llama al extractor', async () => {
    const extractor = vi.fn(async () => fakeBook);
    const res = await ingest(fixture('imagen-con-extension.pdf'), { extractor });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('NOT_PDF');
    expect(typeof res.error.message).toBe('string');
    expect(res.error.message.trim().length).toBeGreaterThan(0);
    expect(extractor).not.toHaveBeenCalled();
  });

  it('[MH-1] bytes vacíos y texto → NOT_PDF sin llamar al extractor', async () => {
    const extractor = vi.fn(async () => fakeBook);
    for (const bytes of [new Uint8Array(0), ascii('no soy un pdf')]) {
      const res = await ingest(bytes, { extractor });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('NOT_PDF');
    }
    expect(extractor).not.toHaveBeenCalled();
  });

  it('[MH-1] un PDF con extensión .txt sí pasa al extractor', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'mh01-'));
    const file = path.join(dir, 'libro.txt');
    writeFileSync(file, readFileSync(path.join(FIXTURES, 'sample.pdf')));
    const extractor = vi.fn(async () => fakeBook);
    const res = await ingest(new Uint8Array(readFileSync(file)), { extractor });
    expect(extractor).toHaveBeenCalledTimes(1);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.book).toEqual(fakeBook);
  });
});
