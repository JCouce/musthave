import { describe, it, expect } from 'vitest';
import { pivotIndex } from '@/core/orp';

describe('[MH-18] pivotIndex según longitud en letras/dígitos', () => {
  it.each([
    ['a', 1, 0],
    ['de', 2, 1],
    ['casas', 5, 1],
    ['cabeza', 6, 2],
    ['escritura', 9, 2],
    ['cerebrales', 10, 3],
    ['desagradables', 13, 3],
    ['constitucional', 14, 4],
    ['internacionalizacion', 20, 4],
  ])('[MH-18] "%s" (longitud %i) → %i', (word, len, expected) => {
    expect(word.length).toBe(len);
    expect(pivotIndex(word)).toBe(expected);
  });

  it.each([
    ['a', 0],
    ['cerebro', 2],
    ['–Hasta', 2],
    ['«¿Hoy', 3],
    ['hola,', 1],
    ['¡¿hola?!', 3],
    ['«¿Hoy?»', 3],
    ['(cerebro).', 3],
    ['acción', 2],
    ['2024', 1],
  ])('[MH-18] "%s" → índice %i (puntuación ignorada para la longitud)', (word, expected) => {
    expect(pivotIndex(word)).toBe(expected);
  });

  it('[MH-18] el pivote de "¡¿hola?!" es la letra "o"', () => {
    expect('¡¿hola?!'[pivotIndex('¡¿hola?!')]).toBe('o');
  });

  it('[MH-18] el pivote de "«¿Hoy" es la letra "o"', () => {
    expect('«¿Hoy'[pivotIndex('«¿Hoy')]).toBe('o');
  });
});
