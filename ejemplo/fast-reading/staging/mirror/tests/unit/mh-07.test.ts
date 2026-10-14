import { describe, it, expect } from 'vitest';
import { normalizeText } from '@/ingest/normalize';

describe('[MH-7] normalizeText', () => {
  it('[MH-7] aplica NFC: tildes y eñes descompuestas pasan a un solo carácter', () => {
    expect(normalizeText('é')).toBe('é');
    expect(normalizeText('ñ')).toBe('ñ');
    expect(normalizeText('Canción del niño')).toBe('Canción del niño');
    expect(normalizeText('Canción').length).toBe(7);
  });

  it.each([
    ['ﬀ', 'ff'],
    ['ﬁ', 'fi'],
    ['ﬂ', 'fl'],
    ['ﬃ', 'ffi'],
    ['ﬄ', 'ffl'],
    ['ﬅ', 'st'],
    ['ﬆ', 'st'],
  ])('[MH-7] ligadura %s → %s', (lig, expected) => {
    expect(normalizeText(lig)).toBe(expected);
  });

  it('[MH-7] ligaduras dentro de palabras', () => {
    expect(normalizeText('eﬁcaz')).toBe('eficaz');
    expect(normalizeText('diﬁcultad suﬁciente')).toBe('dificultad suficiente');
    expect(normalizeText('aﬂuir')).toBe('afluir');
  });

  it('[MH-7] elimina el soft hyphen U+00AD', () => {
    expect(normalizeText('pala­bra')).toBe('palabra');
    expect(normalizeText('in­te­gra­ción')).toBe('integración');
  });

  it('[MH-7] no aplica NFKC: n.º y 1.ª quedan intactos', () => {
    expect(normalizeText('n.º')).toBe('n.º');
    expect(normalizeText('1.ª')).toBe('1.ª');
    expect(normalizeText('el n.º 3 y la 1.ª edición')).toBe('el n.º 3 y la 1.ª edición');
  });

  it('[MH-7] texto normal sale sin cambios (incluida la elipsis …)', () => {
    const s = '–¿Hoy? «¡Sí!», dijo la Dra. Pérez… y añadió: (13.804 niños, 3,5 %) ü Ú.';
    expect(normalizeText(s)).toBe(s);
    expect(normalizeText('')).toBe('');
  });
});
