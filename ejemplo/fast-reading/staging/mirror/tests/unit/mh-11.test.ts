import { describe, it, expect } from 'vitest';
import { tokenize } from '@/core/tokenize';

const OPENING = ['¿', '¡', '«', '(', '–'];

const cases: Array<{ name: string; text: string; words: string[] }> = [
  { name: '¿ con espacio', text: '¿ Vienes?', words: ['¿Vienes?'] },
  { name: '¡ con espacio en mitad de frase', text: 'Dijo ¡ hola! a todos', words: ['Dijo', '¡hola!', 'a', 'todos'] },
  { name: '« con espacio', text: 'Dijo « Hola» y calló', words: ['Dijo', '«Hola»', 'y', 'calló'] },
  { name: '( con espacio', text: 'Lo vi ( ayer) tarde.', words: ['Lo', 'vi', '(ayer)', 'tarde.'] },
  { name: 'raya – con espacio al inicio', text: '– Hasta luego', words: ['–Hasta', 'luego'] },
  { name: 'raya – con espacio en mitad', text: 'Dijo – Hasta luego', words: ['Dijo', '–Hasta', 'luego'] },
  { name: 'tras dos puntos, no se pega a la anterior', text: 'Y dijo: ¿ qué?', words: ['Y', 'dijo:', '¿qué?'] },
  { name: 'salto de línea entre signo y palabra', text: 'Él preguntó ¿\nvienes?', words: ['Él', 'preguntó', '¿vienes?'] },
  { name: 'combinado ya pegado «¿Hoy?»', text: '«¿Hoy?»', words: ['«¿Hoy?»'] },
  { name: 'combinado con espacios « ¿ Hoy?»', text: '« ¿ Hoy?»', words: ['«¿Hoy?»'] },
  { name: 'combinado ¡ ¿ Qué?!', text: '¡ ¿ Qué?!', words: ['¡¿Qué?!'] },
  { name: 'combinado en frase', text: 'Me dijo « ¿ Hoy?» y se fue.', words: ['Me', 'dijo', '«¿Hoy?»', 'y', 'se', 'fue.'] },
  { name: 'ya pegado se mantiene', text: '–Hasta luego, ¿vale?', words: ['–Hasta', 'luego,', '¿vale?'] },
];

describe('[MH-11] tokenize: puntuación de apertura', () => {
  it.each(cases)('[MH-11] $name', ({ text, words }) => {
    expect(tokenize(text).map((t) => t.text)).toEqual(words);
  });

  it('[MH-11] ningún token termina en signo de apertura ni es solo signos de apertura', () => {
    const text =
      'Me preguntó ¿ vienes? y le dije ¡ claro! « Vale» ( dijo) – Hasta luego – y ' +
      '« ¿ Hoy?» respondí ¡ ¿ En serio?! Fin.';
    const tokens = tokenize(text);
    expect(tokens.length).toBeGreaterThan(0);
    for (const { text: w } of tokens) {
      expect(w).not.toMatch(/\s/);
      expect(w.length).toBeGreaterThan(0);
      expect(OPENING.some((o) => w.endsWith(o)), `token "${w}" termina en apertura`).toBe(false);
      expect([...w].every((c) => OPENING.includes(c)), `token "${w}" es solo apertura`).toBe(false);
    }
    const words = tokens.map((t) => t.text);
    expect(words).toContain('¿vienes?');
    expect(words).toContain('¡claro!');
    expect(words).toContain('«Vale»');
    expect(words).toContain('(dijo)');
    expect(words).toContain('–Hasta');
    expect(words).toContain('«¿Hoy?»');
    expect(words).toContain('¡¿En');
  });
});
