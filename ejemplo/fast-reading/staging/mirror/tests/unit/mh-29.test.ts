import { describe, it, expect } from 'vitest';
import { createPlayer } from '@/core/player';
import type { TimedToken } from '@/core/types';
import { FakeClock } from './helpers/fake-clock';

// Frases de 8, 10, 6 y 10 tokens → inicios en 0, 8, 18, 24; total 34.
const LENGTHS = [8, 10, 6, 10];
function sentences(lengths: number[]): TimedToken[] {
  const out: TimedToken[] = [];
  for (const len of lengths) {
    for (let j = 0; j < len; j++) {
      const last = j === len - 1;
      out.push(last ? { text: 'fin.', sentenceEnd: true, sentenceLength: len } : { text: 'la', sentenceLength: len });
    }
  }
  return out;
}
const TOKENS = sentences(LENGTHS);
const N = TOKENS.length;

function playerAt(index: number) {
  const p = createPlayer({ tokens: TOKENS, clock: new FakeClock(), wpm: 300 });
  p.seek(index);
  expect(p.index).toBe(index);
  return p;
}

// Se evita a propósito el caso límite de exactamente 4 tokens desde el inicio (ambigüedad de conteo).
describe('[MH-29] retroceder y avanzar por frases', () => {
  it.each([
    [8, 0], [9, 0], [11, 0],      // frase 2 (inicio 8), 0/1/3 tokens → inicio de la frase 1
    [18, 8], [19, 8], [21, 8],    // frase 3 (inicio 18) → inicio de la frase 2
    [24, 18], [27, 18],           // frase 4 (inicio 24) → inicio de la frase 3
  ])('[MH-29] back() desde %i con menos de 5 tokens en la frase va a %i (inicio de la anterior)', (from, to) => {
    const p = playerAt(from);
    p.back();
    expect(p.index).toBe(to);
  });

  it.each([
    [13, 8], [17, 8],             // 5 y 9 tokens desde el inicio de la frase 2
    [23, 18],                     // 5 tokens desde el inicio de la frase 3
    [29, 24], [33, 24],
    [5, 0], [7, 0],
  ])('[MH-29] back() desde %i con 5 o más tokens en la frase va a %i (inicio de la actual)', (from, to) => {
    const p = playerAt(from);
    p.back();
    expect(p.index).toBe(to);
  });

  it.each([[0], [1], [3]])('[MH-29] back() en la primera frase con menos de 5 tokens (desde %i) va a 0', (from) => {
    const p = playerAt(from);
    p.back();
    expect(p.index).toBe(0);
  });

  it.each([
    [0, 8], [3, 8], [7, 8],
    [8, 18], [12, 18], [17, 18],
    [18, 24], [23, 24],
  ])('[MH-29] forward() desde %i va a %i (inicio de la siguiente)', (from, to) => {
    const p = playerAt(from);
    p.forward();
    expect(p.index).toBe(to);
  });

  it.each([[24], [28], [33]])('[MH-29] forward() en la última frase (desde %i) no se sale del rango', (from) => {
    const p = playerAt(from);
    expect(() => p.forward()).not.toThrow();
    expect(p.index).toBeGreaterThanOrEqual(from);
    expect(p.index).toBeLessThanOrEqual(N - 1);
  });

  it('[MH-29] back() repetido retrocede frase a frase hasta 0', () => {
    const p = playerAt(25);
    p.back();
    expect(p.index).toBe(18);
    p.back();
    expect(p.index).toBe(8);
    p.back();
    expect(p.index).toBe(0);
    p.back();
    expect(p.index).toBe(0);
  });
});
