import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolveLineBreakHyphen } from '@/ingest/dehyphenate';
import type { Book } from '@/core/types';

const BOOK = process.env.RSVP_BOOK ?? '';

// Los 6 guiones de corte reales del libro (pdftotext -raw).
const REAL_CASES: [string, string, string][] = [
  ['des-', 'integrada,', 'desintegrada,'],
  ['re-', 'cuerdos', 'recuerdos'],
  ['aten-', 'ción', 'atención'],
  ['des-', 'plazar', 'desplazar'],
  ['sa-', 'crificios', 'sacrificios'],
  ['lucha-', 'huida-inmovilidad,', 'lucha-huida-inmovilidad,'],
];

describe('[MH-4] resolveLineBreakHyphen', () => {
  it.each(REAL_CASES)('[MH-4] caso real %s + %s → %s', (left, right, expected) => {
    expect(resolveLineBreakHyphen(left, right)).toBe(expected);
  });

  it.each([
    ['auto-', 'móvil', 'automóvil'],
    ['bien-', 'estar.', 'bienestar.'],
    ['ca-', 'sa»', 'casa»'],
    ['ex-', 'alumno-modelo', 'ex-alumno-modelo'],
  ])('[MH-4] sintético %s + %s → %s', (left, right, expected) => {
    expect(resolveLineBreakHyphen(left, right)).toBe(expected);
  });

  it('[MH-4] una raya – en la palabra siguiente no cuenta como guion y se conserva', () => {
    expect(resolveLineBreakHyphen('adul-', 'to–')).toBe('adulto–');
    expect(resolveLineBreakHyphen('per-', 'sona–dijo')).toBe('persona–dijo');
  });

  // LIMITACIÓN CONOCIDA, no es un bug: un compuesto de solo dos partes cortado justo en su guion se une.
  // La regla no puede distinguirlo de un corte silábico. En este libro no ocurre y en español es raro.
  it('[MH-4] limitación conocida: compuesto de dos partes cortado en su guion se une', () => {
    expect(resolveLineBreakHyphen('teórico-', 'práctico')).toBe('teóricopráctico');
  });
});

describe.skipIf(!existsSync(BOOK))('[MH-4] [G] guiones de corte en el libro real', () => {
  let book: Book;
  beforeAll(async () => {
    const { extractBook } = await import('@/ingest/extract');
    book = await extractBook(new Uint8Array(readFileSync(BOOK)));
  });
  const count = (w: string): number => book.words.filter((x) => x === w).length;

  it('[MH-4] los 6 cortes aparecen resueltos, con su puntuación', () => {
    for (const [, , expected] of REAL_CASES) expect(book.words, expected).toContain(expected);
    expect(count('desintegrada,')).toBe(1);
    expect(count('sacrificios')).toBe(1);
    expect(count('lucha-huida-inmovilidad,')).toBe(1);
  });

  it('[MH-4] no quedan los fragmentos sueltos', () => {
    const fragments = [
      'des-', 'integrada,', 're-', 'cuerdos', 'aten-', 'ción', 'plazar',
      'sa-', 'crificios', 'lucha-', 'huida-inmovilidad,',
    ];
    for (const f of fragments) expect(count(f), f).toBe(0);
  });

  it('[MH-4] ninguna palabra termina en guion -', () => {
    expect(book.words.filter((w) => w.endsWith('-'))).toEqual([]);
  });

  it('[MH-4] las rayas – se conservan', () => {
    expect(book.words).toContain('–sea');
    expect(book.words).toContain('adulto–');
  });
});
