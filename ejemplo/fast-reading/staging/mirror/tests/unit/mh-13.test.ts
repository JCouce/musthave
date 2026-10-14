import { describe, it, expect } from 'vitest';
import { cacheKey, PARSER_VERSION } from '@/persist/cacheKey';

const bytes = (s: string) => new TextEncoder().encode(s);
const SAMPLE = '%PDF-1.7\nun libro cualquiera\n%%EOF';

describe('[MH-13] cacheKey = SHA-256 del contenido + versión del parser', () => {
  it('[MH-13] PARSER_VERSION es un string no vacío', () => {
    expect(typeof PARSER_VERSION).toBe('string');
    expect(PARSER_VERSION.length).toBeGreaterThan(0);
  });

  it('[MH-13] es determinista y contiene un hash hex de 64 caracteres', async () => {
    const a = await cacheKey(bytes(SAMPLE));
    const b = await cacheKey(bytes(SAMPLE));
    expect(typeof a).toBe('string');
    expect(a).toBe(b);
    expect(a).toMatch(/[0-9a-f]{64}/);
  });

  it('[MH-13] mismo contenido en otro buffer (otro archivo/nombre) → misma clave', async () => {
    const original = bytes(SAMPLE);
    const copia = new Uint8Array(original); // copia independiente
    expect(await cacheKey(copia)).toBe(await cacheKey(original));
  });

  it('[MH-13] mismo contenido como vista de un buffer mayor → misma clave', async () => {
    const original = bytes(SAMPLE);
    const big = new Uint8Array(original.length + 20);
    big.set(original, 10);
    const view = big.subarray(10, 10 + original.length);
    expect(await cacheKey(view)).toBe(await cacheKey(original));
  });

  it('[MH-13] un byte distinto → otra clave', async () => {
    const a = bytes(SAMPLE);
    const b = new Uint8Array(a);
    b[b.length - 1] ^= 0x01;
    expect(await cacheKey(b)).not.toBe(await cacheKey(a));
  });

  it('[MH-13] otra versión del parser → otra clave', async () => {
    const a = bytes(SAMPLE);
    const k1 = await cacheKey(a, 'v1');
    const k2 = await cacheKey(a, 'v2');
    expect(k1).not.toBe(k2);
    expect(await cacheKey(a, 'v1')).toBe(k1);
  });

  it('[MH-13] por defecto usa PARSER_VERSION', async () => {
    const a = bytes(SAMPLE);
    expect(await cacheKey(a)).toBe(await cacheKey(a, PARSER_VERSION));
    expect(await cacheKey(a)).not.toBe(await cacheKey(a, PARSER_VERSION + '-otra'));
  });
});
