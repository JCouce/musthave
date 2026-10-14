import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { extractBook } from '@/ingest/extract';
import type { Book } from '@/core/types';

const FIXTURES = process.env.FIXTURES ?? '';
const BOOK = process.env.RSVP_BOOK ?? '';

interface Truth { words: string[]; paragraphStarts: number[]; pageCount: number }

describe('[MH-5] párrafos en el PDF sintético (sangría, hueco, cruce de página e imagen)', () => {
  let book: Book;
  let truth: Truth;
  beforeAll(async () => {
    truth = JSON.parse(readFileSync(path.join(FIXTURES, 'paragraphs.truth.json'), 'utf8')) as Truth;
    book = await extractBook(new Uint8Array(readFileSync(path.join(FIXTURES, 'paragraphs.pdf'))));
  });

  it('[MH-5] las palabras coinciden exactamente con la solución', () => {
    expect(book.words).toEqual(truth.words);
  });

  it('[MH-5] paragraphStarts: precisión ≥ 0,95 y recall ≥ 0,90', () => {
    const predicted = new Set(book.paragraphStarts);
    const expected = new Set(truth.paragraphStarts);
    const tp = [...predicted].filter((i) => expected.has(i)).length;
    const precision = predicted.size === 0 ? 0 : tp / predicted.size;
    const recall = tp / expected.size;
    expect(precision, `pred=${JSON.stringify(book.paragraphStarts)}`).toBeGreaterThanOrEqual(0.95);
    expect(recall, `pred=${JSON.stringify(book.paragraphStarts)}`).toBeGreaterThanOrEqual(0.9);
  });

  it('[MH-5] paragraphStarts es ascendente y empieza en 0', () => {
    const ps = book.paragraphStarts;
    expect(ps[0]).toBe(0);
    for (let i = 1; i < ps.length; i++) expect(ps[i]).toBeGreaterThan(ps[i - 1]);
  });
});

describe.skipIf(!existsSync(BOOK))('[MH-5] [G] párrafos del libro real (sanity)', () => {
  let book: Book;
  beforeAll(async () => {
    book = await extractBook(new Uint8Array(readFileSync(BOOK)));
  });

  it('[MH-5] paragraphStarts ascendente estricto, empieza en 0 y dentro de rango', () => {
    const ps = book.paragraphStarts;
    expect(ps[0]).toBe(0);
    for (let i = 1; i < ps.length; i++) {
      if (!(ps[i] > ps[i - 1])) throw new Error(`no ascendente en ${i}: ${ps[i - 1]} → ${ps[i]}`);
    }
    expect(ps[ps.length - 1]).toBeLessThan(book.words.length);
  });

  it('[MH-5] entre 300 y 3000 párrafos', () => {
    expect(book.paragraphStarts.length).toBeGreaterThanOrEqual(300);
    expect(book.paragraphStarts.length).toBeLessThanOrEqual(3000);
  });

  // Un párrafo que empieza en minúscula es casi siempre un salto de renglón mal unido.
  // Únicas excepciones legítimas, comprobadas a mano contra el PDF: la portada (pág. 2, "y Tina Payne Bryson"),
  // la URL bajo la firma de la introducción y la web del colofón (pág. 219). Fuera de esa lista: cero.
  const LEGIT_LOWERCASE_STARTS = [['y', 'Tina'], ['www.WholeBrainChild.com'], ['www.albaeditorial.es']];
  it('[MH-5] ningún párrafo empieza en minúscula salvo los casos legítimos conocidos', () => {
    const lower = book.paragraphStarts.filter((i) => {
      const letter = book.words[i]?.match(/\p{L}/u)?.[0];
      return letter !== undefined && /\p{Ll}/u.test(letter);
    });
    const unexpected = lower.filter((i) => !LEGIT_LOWERCASE_STARTS.some((seq) => seq.every((w, k) => book.words[i + k] === w)));
    expect(unexpected.map((i) => book.words.slice(Math.max(0, i - 3), i + 5).join(' '))).toEqual([]);
  });
});
