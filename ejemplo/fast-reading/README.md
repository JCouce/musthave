# Ejemplo real: fast-reading

Lector RSVP de PDFs en el navegador (Vite + TypeScript + pdf.js), construido entero por el bucle: 31 MUST-HAVEs y 260 tests, en verde en 1 h 15 min. Los números y lo que salió mal están en [LECCIONES.md](../../LECCIONES.md#fast-reading-octubre-2026).

Esto es material para **leer y copiar la forma**, no para ejecutarlo tal cual: falta el libro (ver abajo).

## Qué hay y en qué fase de la guía se hizo

| Fichero | Fase | Qué mirar |
|---|---|---|
| [repo/MUST_HAVES.md](repo/MUST_HAVES.md) | 1 | Cómo se escribe un requisito comprobable, con números exactos sacados del libro real |
| [repo/docs/CONTRACT.md](repo/docs/CONTRACT.md) | 2 | Firmas exactas, la MH dueña de cada módulo, las trampas de los datos y la tabla de `data-testid` |
| [repo/AGENT.md](repo/AGENT.md), [repo/init.sh](repo/init.sh) | 3 | Lo que había al arrancar el bucle (luego el constructor fue añadiendo notas) |
| [staging/mirror/tests/](staging/mirror/tests/) | 4.1 | 24 ficheros unitarios y 7 e2e. Fíjate en los `[G]` (libro real) y en `helpers/fake-clock.ts` (reloj falso para probar tiempos sin esperar) |
| [staging/mirror/fixtures/](staging/mirror/fixtures/) | 4.1 | PDFs sintéticos de solución conocida y su generador `gen.cjs` |
| [staging/rubrics/](staging/rubrics/) | 4.3 | Las 7 rúbricas del evaluador, todas de UI |
| [staging/feature_list.json](staging/feature_list.json) | 4.4 | Prioridades, dependencias y `provides`. **Es la versión corregida**: con las dependencias que tenía al lanzar el bucle (y los `provides` puestos), `check-deps.sh` saca 3 errores |
| [staging/project.env](staging/project.env) | 4 | Perfil, ficheros del evaluador y herramientas extra (`pdftotext`) |
| [repo/decisions/answered/MH-04.md](repo/decisions/answered/MH-04.md) | 8 | La pregunta que dejó el constructor cuando vio que MH-04 necesitaba MH-03, y la respuesta |
| [loop.log](loop.log) | 7-8 | Las dos tandas: parada por la decisión y relanzamiento hasta `TERMINADO` |
| [report.txt](report.txt) | 9 | Estado final y consumo por rol |
| [repo/progress-final.md](repo/progress-final.md) | 9 | Una línea por sesión del constructor: qué hizo y "qué queda raro" |

## Lo que no está

- **El libro** (*El cerebro del niño*, Siegel y Payne Bryson; 220 páginas). Tiene copyright. Los tests `[G]` (MH-03, 04, 05, 06 y 08) lo buscan en `fixtures/book.pdf` mediante `RSVP_BOOK`, y sin él se saltan, y un test saltado cuenta como fallo. Para reproducir el proyecto necesitas tu propio PDF y reescribir esos tests con sus números.
- **El código de la app**: está en su propio repo. Aquí solo va lo que hace falta para entender el método.

## Comprobar el ejemplo

```sh
MUSTHAVE_HOME=$PWD/ejemplo core/bin/check-deps.sh fast-reading     # desde la raíz del repo
```
