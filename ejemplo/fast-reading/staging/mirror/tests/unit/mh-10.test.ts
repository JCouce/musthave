import { describe, it, expect } from 'vitest';
import { tokenize } from '@/core/tokenize';

// Cada caso: texto y lista ordenada de los tokens que deben llevar sentenceEnd = true.
// El resto de tokens debe llevar sentenceEnd = false.
const cases: Array<{ name: string; text: string; ends: string[] }> = [
  // NO son fin de frase
  { name: 'Sr. seguido de nombre propio', text: 'Vino el Sr. García a casa.', ends: ['casa.'] },
  { name: 'Dra. seguido de nombre propio', text: 'La Dra. López operó ayer.', ends: ['ayer.'] },
  { name: 'Sr. seguido de minúscula', text: 'Habló con el Sr. que vino.', ends: ['vino.'] },
  { name: 'etc. seguido de minúscula', text: 'Compró pan, leche, etc. y se fue.', ends: ['fue.'] },
  { name: 'p. ej.', text: 'Frutas, p. ej. manzanas, son sanas.', ends: ['sanas.'] },
  { name: 'p. ej. seguido de mayúscula', text: 'Ciudades, p. ej. Madrid, crecen.', ends: ['crecen.'] },
  { name: 'EE. UU.', text: 'Viajó a EE. UU. el lunes.', ends: ['lunes.'] },
  { name: 'EE. UU. seguido de mayúscula', text: 'En EE. UU. Obama ganó.', ends: ['ganó.'] },
  { name: 'n.º', text: 'Vive en el n.º 5 de la calle.', ends: ['calle.'] },
  { name: 'iniciales J. R.', text: 'Lo escribió J. R. Tolkien en Oxford.', ends: ['Oxford.'] },
  { name: 'iniciales J. R. R.', text: 'Leí a J. R. R. Tolkien ayer.', ends: ['ayer.'] },
  { name: 'número con punto de miles', text: 'El libro tiene 13.804 palabras.', ends: ['palabras.'] },
  { name: 'número decimal con coma', text: 'Pesa 3,5 kilos exactos.', ends: ['exactos.'] },
  { name: 'URL www', text: 'Visita www.ejemplo.com para más.', ends: ['más.'] },
  { name: 'URL https', text: 'Ver https://a.b/c.html para detalles.', ends: ['detalles.'] },
  { name: 'punto seguido de minúscula', text: 'Dijo hola. y se fue.', ends: ['fue.'] },
  // SÍ son fin de frase
  { name: 'punto normal', text: 'Llegó tarde. Nadie lo esperaba.', ends: ['tarde.', 'esperaba.'] },
  { name: 'puntos suspensivos …', text: 'Esperó… Luego se fue.', ends: ['Esperó…', 'fue.'] },
  { name: 'puntos suspensivos ...', text: 'Esperó... Luego se fue.', ends: ['Esperó...', 'fue.'] },
  { name: '!». seguido de mayúscula', text: 'Gritó «¡Basta!». Ella calló.', ends: ['«¡Basta!».', 'calló.'] },
  { name: '?». seguido de mayúscula', text: 'Preguntó «¿Vienes?». Nadie respondió.', ends: ['«¿Vienes?».', 'respondió.'] },
  { name: '». seguido de mayúscula', text: 'Dijo «basta». Luego calló.', ends: ['«basta».', 'calló.'] },
  { name: '? y ! seguidos de mayúscula', text: '¿Vienes? Sí. ¡Genial! Vamos.', ends: ['¿Vienes?', 'Sí.', '¡Genial!', 'Vamos.'] },
  { name: 'punto seguido de signo de apertura y mayúscula', text: 'Llegó tarde. ¿Por qué? Nadie lo sabe.', ends: ['tarde.', 'qué?', 'sabe.'] },
  { name: 'punto seguido de « y mayúscula', text: 'Terminó. «Nunca más», dijo.', ends: ['Terminó.', 'dijo.'] },
  { name: 'saltos de línea como separador', text: 'Era de noche.\nTodos dormían.', ends: ['noche.', 'dormían.'] },
  { name: 'último token acabado en punto', text: 'Una frase sola.', ends: ['sola.'] },
];

describe('[MH-10] tokenize: fin de frase en español', () => {
  it.each(cases)('[MH-10] $name', ({ text, ends }) => {
    const tokens = tokenize(text);
    expect(tokens.length).toBeGreaterThan(0);
    for (const t of tokens) expect(typeof t.sentenceEnd).toBe('boolean');
    expect(tokens.filter((t) => t.sentenceEnd).map((t) => t.text)).toEqual(ends);
  });

  it('[MH-10] separa por espacios en blanco sin alterar palabras normales', () => {
    expect(tokenize('Vino el Sr. García a casa.').map((t) => t.text)).toEqual([
      'Vino', 'el', 'Sr.', 'García', 'a', 'casa.',
    ]);
  });

  it('[MH-10] el último token de un texto que acaba en "." es fin de frase', () => {
    const tokens = tokenize('Esto es todo por hoy.');
    expect(tokens[tokens.length - 1]).toEqual({ text: 'hoy.', sentenceEnd: true });
  });
});
