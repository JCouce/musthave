import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { extractBook } from '@/ingest/extract';
import { ingest } from '@/ingest/ingest';
import type { Book } from '@/core/types';

const BOOK = process.env.RSVP_BOOK ?? '';

// Caracteres que delatan basura: controles, U+FFFD y uso privado (fuentes ofuscadas).
const GARBAGE = /[\u0000-\u001f\u007f-\u009f�-]/u;

describe.skipIf(!existsSync(BOOK))('[MH-8] [G] páginas sin texto (1 y 135) no rompen ni meten basura', () => {
  let book: Book;
  let failure: unknown;
  beforeAll(async () => {
    try {
      book = await extractBook(new Uint8Array(readFileSync(BOOK)));
    } catch (e) {
      failure = e;
    }
  });

  it('[MH-8] extractBook no lanza y devuelve las 220 páginas', () => {
    expect(failure).toBeUndefined();
    expect(book.pageCount).toBe(220);
  });

  it('[MH-8] ninguna palabra contiene caracteres basura', () => {
    expect(book.words.filter((w) => GARBAGE.test(w))).toEqual([]);
  });

  it('[MH-8] las viñetas de lista (· •) no salen como palabra: se convierten en inicios de elemento de lista', () => {
    // pdf.js saca 49 viñetas (37 · y 12 •); pdftotext -raw ve 42 renglones que empiezan por viñeta.
    expect(book.words.filter((w) => w === '·' || w === '•')).toEqual([]);
    expect(book.listItemStarts.length).toBeGreaterThanOrEqual(42);
    expect(book.listItemStarts.length).toBeLessThanOrEqual(49);
    expect([...book.listItemStarts].sort((a, b) => a - b)).toEqual(book.listItemStarts);
    for (const i of book.listItemStarts) expect(book.words[i]).toMatch(/[\p{L}\p{N}]/u);
  });

  it('[MH-8] las 6 rayas de inciso al final de renglón se pegan a la palabra siguiente (MH-11)', () => {
    expect(book.words.filter((w) => w === '–')).toEqual([]);
    for (const w of ['–padres,', '–simplemente', '–cuando', '–sobre', '–animándolos', '–con']) expect(book.words).toContain(w);
  });

  it('[MH-8] el resto de palabras sin letra ni dígito son solo signos y como mucho el 0,5 %', () => {
    // Quedan legítimos = + © @ (unos 10).
    const noAlnum = book.words.filter((w) => !/[\p{L}\p{N}]/u.test(w));
    expect(noAlnum.filter((w) => !/^[\p{P}\p{S}]+$/u.test(w))).toEqual([]);
    expect(noAlnum.length).toBeLessThanOrEqual(Math.floor(book.words.length * 0.005));
  });

  it('[MH-8] ingest del libro completo → ok con 220 páginas', async () => {
    const res = await ingest(new Uint8Array(readFileSync(BOOK)));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.book.pageCount).toBe(220);
  });
});
