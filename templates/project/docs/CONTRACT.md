# Contrato v1 — {{PROJECT}}

Interfaz pública que exigen los tests de aceptación. Los tests importan exactamente estas rutas y nombres.
Todo lo demás (estructura interna, estilos, helpers) es libre.

Stack: …  Tests: …  Cómo se sirve la app para e2e: …

Requisitos completos: `MUST_HAVES.md`.

<!--
Por cada módulo: ruta, firma exacta y comportamiento, y entre paréntesis las MH que lo exigen.
La PRIMERA MH de la lista es la dueña: la que lo implementa. Ponla también en "provides" de feature_list.json,
para que check-deps.sh avise si otra feature usa el módulo sin depender de su dueña.
Si hay UI: tabla de data-testid que localizan los e2e (nunca por texto ni por CSS).
-->

## Tipos compartidos — `src/core/types.ts`

```ts
export interface Ejemplo { … }
```

## `src/core/ejemplo.ts`
- `funcion(a: string): number` — qué devuelve, casos límite. (MH-1, MH-3)

## UI — data-testid

| testid | qué es |
|---|---|
| `title` | … (MH-2) |
