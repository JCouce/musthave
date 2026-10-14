import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { extractBook } from '@/ingest/extract';
import type { Book } from '@/core/types';

const BOOK = process.env.RSVP_BOOK ?? '';

describe.skipIf(!existsSync(BOOK))('[MH-3] [G] extracción completa del libro real', () => {
  let book: Book;
  beforeAll(async () => {
    book = await extractBook(new Uint8Array(readFileSync(BOOK)));
  });

  it('[MH-3] salen 58.594 palabras ±1 % (pdftotext)', () => {
    expect(book.words.length).toBeGreaterThanOrEqual(58008);
    expect(book.words.length).toBeLessThanOrEqual(59180);
  });

  it('[MH-3] ninguna palabra vacía', () => {
    const empty = book.words.filter((w) => typeof w !== 'string' || w.length === 0);
    expect(empty.length).toBe(0);
  });

  it('[MH-3] ninguna palabra contiene espacios ni saltos de línea', () => {
    const bad = book.words.filter((w) => /\s/.test(w));
    expect(bad.slice(0, 10)).toEqual([]);
  });
});
