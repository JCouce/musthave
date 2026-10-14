import { describe, it, expect } from 'vitest';
import { createPlayer } from '@/core/player';
import { buildSchedule } from '@/core/timing';
import type { TimedToken } from '@/core/types';
import { FakeClock } from './helpers/fake-clock';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const expectedRemaining = (tokens: TimedToken[], index: number, wpm: number) =>
  sum(buildSchedule(tokens.slice(index), wpm).map((f) => f.duration));

// Mezcla con comas, palabras largas, números, fines de frase y de párrafo y un título.
const MIXED: TimedToken[] = [
  { text: 'Capítulo', isTitle: true },
  { text: 'uno', isTitle: true },
  { text: 'Había', sentenceLength: 6 },
  { text: 'una', sentenceLength: 6 },
  { text: 'vez,', sentenceLength: 6 },
  { text: 'extraordinariamente', sentenceLength: 6 },
  { text: '1.250', sentenceLength: 6 },
  { text: 'niños.', sentenceEnd: true, sentenceLength: 6 },
  { text: 'Luego', sentenceLength: 4 },
  { text: 'vino;', sentenceLength: 4 },
  { text: 'otro', sentenceLength: 4 },
  { text: 'día.', sentenceEnd: true, paragraphEnd: true, sentenceLength: 4 },
  { text: 'Y', sentenceLength: 3 },
  { text: 'nada', sentenceLength: 3 },
  { text: 'más.', sentenceEnd: true, paragraphEnd: true, sentenceLength: 3 },
];

describe('[MH-32] progreso y tiempo restante', () => {
  it('[MH-32] progress() = index / longitud', () => {
    const tokens: TimedToken[] = Array.from({ length: 20 }, () => ({ text: 'la' }));
    const p = createPlayer({ tokens, clock: new FakeClock() });
    expect(p.progress()).toBe(0);
    p.seek(5);
    expect(p.progress()).toBeCloseTo(0.25, 10);
    p.seek(19);
    expect(p.progress()).toBeCloseTo(19 / 20, 10);
  });

  it.each([[0], [3], [7], [8], [12], [14]])(
    '[MH-32] remainingMs() desde %i = suma de buildSchedule(tokens.slice(index), wpm)',
    (index) => {
      const p = createPlayer({ tokens: MIXED, clock: new FakeClock(), wpm: 300 });
      p.seek(index);
      expect(p.remainingMs()).toBeCloseTo(expectedRemaining(MIXED, index, 300), 3);
      p.setWpm(450);
      expect(p.remainingMs()).toBeCloseTo(expectedRemaining(MIXED, index, 450), 3);
    },
  );

  it('[MH-32] remainingMs() no es palabras/wpm cuando hay multiplicadores', () => {
    // 30 palabras con coma y 10 frases cortas: la suma real queda muy por encima de 40 × 200 ms.
    const tokens: TimedToken[] = [];
    for (let i = 0; i < 30; i++) tokens.push({ text: 'sí,' });
    for (let i = 0; i < 10; i++) tokens.push({ text: 'no.', sentenceEnd: true, sentenceLength: 1 });
    const p = createPlayer({ tokens, clock: new FakeClock(), wpm: 300 });
    const naive = (tokens.length * 60000) / 300;
    const remaining = p.remainingMs();
    expect(remaining).toBeCloseTo(expectedRemaining(tokens, 0, 300), 3);
    expect(remaining).toBeGreaterThan(naive * 1.5);
  });

  it('[MH-32] remainingMs() no incluye rampa: durante la reproducción sigue cuadrando con buildSchedule', () => {
    const clock = new FakeClock();
    const p = createPlayer({ tokens: MIXED, clock, wpm: 300 });
    p.play();
    clock.advance(700);
    const i = p.index;
    expect(p.remainingMs()).toBeCloseTo(expectedRemaining(MIXED, i, 300), 3);
    p.pause();
  });
});
