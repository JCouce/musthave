import { describe, it, expect } from 'vitest';
import { durationMultiplier, wordDuration } from '@/core/timing';
import type { TimedToken } from '@/core/types';

const cases: Array<[string, TimedToken, number]> = [
  ['palabra corta', { text: 'sol' }, 1],
  ['5 letras', { text: 'perro' }, 1],
  ['abreviatura sin sentenceEnd', { text: 'Sr.' }, 1],
  ['6 letras', { text: 'cabeza' }, 1.2],
  ['9 letras', { text: 'escritura' }, 1.2],
  ['10 letras', { text: 'cerebrales' }, 1.5],
  ['13 letras', { text: 'desagradables' }, 1.5],
  ['coma', { text: 'hola,' }, 1.8],
  ['punto y coma', { text: 'hola;' }, 2],
  ['dos puntos', { text: 'hola:' }, 2],
  ['fin de frase', { text: 'fin.', sentenceEnd: true }, 2.2],
  ['fin de frase de 22 palabras', { text: 'fin.', sentenceEnd: true, sentenceLength: 22 }, 2.2],
  ['fin de frase de 23 palabras', { text: 'fin.', sentenceEnd: true, sentenceLength: 23 }, 3],
  ['fin de párrafo', { text: 'fin', paragraphEnd: true }, 3],
  ['título', { text: 'Uno', isTitle: true }, 3],
  ['número 2024', { text: '2024' }, 1.9],
  ['número 13.804', { text: '13.804' }, 2.0],
  ['número 3,5', { text: '3,5' }, 1.7],
  ['número de 6 dígitos gana a longitud', { text: '123456' }, 2.1],
  ['número con coma detrás → máximo', { text: '2024,' }, 1.9],
  ['máximo, no producto: 10 letras + coma', { text: 'cerebrales,' }, 1.8],
  ['máximo, no producto: 6 letras + ;', { text: 'cabeza;' }, 2],
  ['máximo, no producto: 10 letras + fin de frase', { text: 'cerebrales.', sentenceEnd: true }, 2.2],
  ['máximo, no producto: fin de frase larga + párrafo + título', { text: 'fin.', sentenceEnd: true, sentenceLength: 30, paragraphEnd: true, isTitle: true }, 3],
  ['tope ×4: número de 30 dígitos', { text: '1'.repeat(30) }, 4],
  ['número de 25 dígitos = 4', { text: '1'.repeat(25) }, 4],
];

describe('[MH-21] durationMultiplier', () => {
  it.each(cases)('[MH-21] %s', (_name, token, expected) => {
    expect(durationMultiplier(token)).toBeCloseTo(expected, 5);
  });
});

describe('[MH-21] wordDuration = 60000/wpm × multiplicador', () => {
  it.each([
    [{ text: 'sol' }, 300, 200],
    [{ text: 'sol' }, 600, 100],
    [{ text: 'cabeza' }, 300, 240],
    [{ text: 'hola,' }, 600, 180],
    [{ text: 'fin.', sentenceEnd: true }, 300, 440],
    [{ text: '1'.repeat(30) }, 600, 400],
  ] as Array<[TimedToken, number, number]>)('[MH-21] %o a %i wpm → %i ms', (token, wpm, ms) => {
    expect(wordDuration(token, wpm)).toBeCloseTo(ms, 5);
  });
});
