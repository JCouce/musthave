import { describe, it, expect } from 'vitest';
import { buildSchedule, wordDuration } from '@/core/timing';
import type { TimedToken } from '@/core/types';

type Kind = number | 'B';
const shape = (tokens: TimedToken[], wpm = 300): Kind[] =>
  buildSchedule(tokens, wpm).map((f) => (f.kind === 'word' ? f.index : 'B'));

describe('[MH-22] buildSchedule: pantalla en blanco', () => {
  it('[MH-22] sin fines de frase ni títulos no hay blancos', () => {
    const tokens: TimedToken[] = [{ text: 'uno' }, { text: 'dos,' }, { text: 'tres' }];
    expect(shape(tokens)).toEqual([0, 1, 2]);
  });

  it('[MH-22] lista vacía → sin frames', () => {
    expect(buildSchedule([], 300)).toEqual([]);
  });

  it('[MH-22] blanco tras cada fin de frase', () => {
    const tokens: TimedToken[] = [
      { text: 'Era', sentenceLength: 2 },
      { text: 'tarde.', sentenceEnd: true, sentenceLength: 2 },
      { text: 'Luego', sentenceLength: 2 },
      { text: 'salió.', sentenceEnd: true, sentenceLength: 2 },
    ];
    expect(shape(tokens)).toEqual([0, 1, 'B', 2, 3, 'B']);
  });

  it('[MH-22] blanco antes de cada inicio de elemento de lista (la viñeta se convierte en pausa)', () => {
    const tokens: TimedToken[] = [
      { text: 'Dos', sentenceLength: 4 },
      { text: 'cosas:', sentenceLength: 4 },
      { text: 'jugar', listItemStart: true, sentenceLength: 4 },
      { text: 'leer', listItemStart: true, sentenceLength: 4 },
    ];
    expect(shape(tokens)).toEqual([0, 1, 'B', 2, 'B', 3]);
  });

  it('[MH-22] blanco antes y después de un título al principio', () => {
    const tokens: TimedToken[] = [
      { text: 'Capítulo', isTitle: true },
      { text: 'uno', isTitle: true },
      { text: 'Era' },
      { text: 'tarde.', sentenceEnd: true },
      { text: 'Luego' },
      { text: 'salió.', sentenceEnd: true, paragraphEnd: true },
    ];
    expect(shape(tokens)).toEqual(['B', 0, 1, 'B', 2, 3, 'B', 4, 5, 'B']);
  });

  it('[MH-22] blanco antes y después de un título en medio', () => {
    const tokens: TimedToken[] = [
      { text: 'hola' },
      { text: 'mundo', paragraphEnd: true },
      { text: 'Parte', isTitle: true },
      { text: 'dos', isTitle: true },
      { text: 'Sigue.', sentenceEnd: true },
    ];
    expect(shape(tokens)).toEqual([0, 1, 'B', 2, 3, 'B', 4, 'B']);
  });

  it('[MH-22] blanco antes y después de un título al final', () => {
    const tokens: TimedToken[] = [{ text: 'a' }, { text: 'b' }, { text: 'Epílogo', isTitle: true }];
    expect(shape(tokens)).toEqual([0, 1, 'B', 2, 'B']);
  });

  it('[MH-22] frames word cubren todos los índices en orden con duration = wordDuration; blancos > 0', () => {
    const tokens: TimedToken[] = [];
    for (let i = 0; i < 60; i++) {
      tokens.push({
        text: i % 7 === 0 ? 'cerebrales,' : 'palabra',
        sentenceEnd: i % 10 === 9,
        sentenceLength: 10,
        paragraphEnd: i % 20 === 19,
        isTitle: i >= 33 && i < 36 ? true : undefined,
      });
    }
    for (const wpm of [300, 600]) {
      const frames = buildSchedule(tokens, wpm);
      const words = frames.filter((f) => f.kind === 'word');
      expect(words.map((f) => (f.kind === 'word' ? f.index : -1))).toEqual(tokens.map((_, i) => i));
      for (const f of frames) {
        if (f.kind === 'word') expect(f.duration).toBeCloseTo(wordDuration(tokens[f.index], wpm), 5);
        else expect(f.duration).toBeGreaterThan(0);
      }
      // 6 fines de frase (9, 19, …, 59) + antes y después del título 33–35, que no toca ningún fin de frase
      expect(frames.filter((f) => f.kind === 'blank')).toHaveLength(8);
    }
  });
});
