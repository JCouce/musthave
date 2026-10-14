// EJEMPLO: bórralo y escribe los tuyos. Regla: el nombre del fichero lleva el id (mh-01) y cada test
// empieza por [MH-01]. Importa la app SOLO por las rutas del contrato (docs/CONTRACT.md).
import { describe, it, expect } from 'vitest';
import { suma } from '@/core/suma';

describe('[MH-01] suma', () => {
  it('[MH-01] suma dos enteros', () => {
    expect(suma(2, 3)).toBe(5);
  });
});
