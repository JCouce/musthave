import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { extractBook } from '@/ingest/extract';
import type { Book } from '@/core/types';

const BOOK = process.env.RSVP_BOOK ?? '';

describe.skipIf(!existsSync(BOOK))('[MH-6] [G] títulos del libro real', () => {
  let book: Book;
  beforeAll(async () => {
    book = await extractBook(new Uint8Array(readFileSync(BOOK)));
  });

  it('[MH-6] "APLICACIÓN DE LA ESTRATEGIA" sale 48 veces como título', () => {
    expect(book.titles.filter((t) => t.text === 'APLICACIÓN DE LA ESTRATEGIA').length).toBe(48);
  });

  it('[MH-6] "Adentrarse en la corriente … rigidez" es un único título', () => {
    const hits = book.titles.filter(
      (t) => t.text.startsWith('Adentrarse en la corriente') && /rigidez$/.test(t.text),
    );
    expect(hits.length).toBe(1);
    expect(book.titles.filter((t) => t.text.startsWith('Adentrarse en la corriente')).length).toBe(1);
  });

  it('[MH-6] cada título es coherente con words: text === words.slice(start, end).join(" ")', () => {
    for (const t of book.titles) {
      expect(Number.isInteger(t.start) && Number.isInteger(t.end)).toBe(true);
      expect(t.start).toBeGreaterThanOrEqual(0);
      expect(t.end).toBeGreaterThan(t.start);
      expect(t.end).toBeLessThanOrEqual(book.words.length);
      expect(t.text).toBe(book.words.slice(t.start, t.end).join(' '));
    }
  });

  it('[MH-6] los títulos van en orden y no se solapan', () => {
    for (let i = 1; i < book.titles.length; i++) {
      expect(book.titles[i].start).toBeGreaterThanOrEqual(book.titles[i - 1].end);
    }
  });
});
