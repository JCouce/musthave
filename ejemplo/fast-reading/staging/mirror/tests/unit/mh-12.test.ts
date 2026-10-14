import { describe, it, expect } from 'vitest';
import { splitLong } from '@/core/tokenize';

// Quita el '-' añadido al final de todos los trozos menos el último y une.
const rejoin = (parts: string[]) =>
  parts.map((p, i) => (i < parts.length - 1 ? p.replace(/-$/, '') : p)).join('');

describe('[MH-12] splitLong: palabras de 14 o más letras', () => {
  it.each([
    ['casa'],
    ['cerebro'],
    ['desagradables'], // 13 letras
    ['desagradables,'], // 13 letras + coma: 14 caracteres pero 13 alfanuméricos
    ['bien-estar'], // guion pero < 14 alfanuméricos
    ['–Hasta'],
  ])('[MH-12] "%s" (< 14 alfanuméricos) no se parte', (w) => {
    expect(splitLong(w)).toEqual([w]);
  });

  it('[MH-12] "extraordinariamente" (19) → 3 trozos con "-" añadido en los dos primeros', () => {
    const parts = splitLong('extraordinariamente');
    expect(parts).toHaveLength(3);
    expect(parts[0].endsWith('-')).toBe(true);
    expect(parts[1].endsWith('-')).toBe(true);
    expect(parts[2].endsWith('-')).toBe(false);
    for (const p of parts) expect(p.replace(/-$/, '').length).toBeGreaterThan(0);
    expect(rejoin(parts)).toBe('extraordinariamente');
  });

  it('[MH-12] "extraordinariamente," → la coma solo en el último trozo', () => {
    const parts = splitLong('extraordinariamente,');
    expect(parts).toHaveLength(3); // ⌈20/8⌉
    expect(parts[0].endsWith('-')).toBe(true);
    expect(parts[1].endsWith('-')).toBe(true);
    expect(parts[2].endsWith(',')).toBe(true);
    expect(parts.slice(0, 2).some((p) => p.includes(','))).toBe(false);
    expect(rejoin(parts)).toBe('extraordinariamente,');
  });

  it('[MH-12] con guion se parte tras cada guion', () => {
    expect(splitLong('lucha-huida-inmovilidad')).toEqual(['lucha-', 'huida-', 'inmovilidad']);
  });

  it('[MH-12] con guion y puntuación final, la puntuación va en el último trozo', () => {
    expect(splitLong('lucha-huida-inmovilidad.')).toEqual(['lucha-', 'huida-', 'inmovilidad.']);
  });

  it('[MH-12] URL www.WholeBrainChild.com (23) → 3 trozos', () => {
    const parts = splitLong('www.WholeBrainChild.com');
    expect(parts).toHaveLength(3);
    expect(parts[0].endsWith('-')).toBe(true);
    expect(parts[1].endsWith('-')).toBe(true);
    expect(rejoin(parts)).toBe('www.WholeBrainChild.com');
  });

  it('[MH-12] 14 letras exactas sí se parte (⌈14/8⌉ = 2)', () => {
    const parts = splitLong('constitucional');
    expect(parts).toHaveLength(2);
    expect(parts[0].endsWith('-')).toBe(true);
    expect(rejoin(parts)).toBe('constitucional');
  });

  it('[MH-12] las letras con tilde cuentan como letras (transformación = 14)', () => {
    const parts = splitLong('transformación');
    expect(parts).toHaveLength(2);
    expect(rejoin(parts)).toBe('transformación');
  });

  it('[MH-12] ⌈len/8⌉ trozos para palabras largas sin guion', () => {
    const w = 'electroencefalografista'; // 23
    const parts = splitLong(w);
    expect(parts).toHaveLength(Math.ceil(w.length / 8));
    expect(rejoin(parts)).toBe(w);
  });
});
