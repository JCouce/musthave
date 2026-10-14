# Perfiles de stack

El núcleo (`core/`) no sabe nada de lenguajes ni frameworks. Todo lo que depende del stack (cómo se instala, se compila, se pasan los tests y se sirve la app) vive en un **perfil**. Cada proyecto elige el suyo en `project.env`:

```sh
PROFILE=node-vitest-playwright        # una carpeta de profiles/
PROFILE=/ruta/a/mi-perfil             # o un perfil propio fuera del repo
```

Al congelar, el perfil se copia dentro del oráculo, así que queda congelado con él.

## Perfiles que hay

| Perfil | Stack | Estado |
|---|---|---|
| [node-vitest-playwright](node-vitest-playwright/) | Node + TypeScript, Vitest para unitarios, Playwright para e2e, Vite para servir | probado en fast-reading (31 MH, 260 tests) |

No hay perfiles para stacks que no se han usado todavía: uno sin probar es peor que no tener ninguno. Cuando toque otro stack, escribe uno siguiendo este contrato y pruébalo con la [fase 4.2 de la guía](../GUIA.md#42-validar-los-tests-que-no-se-te-salte).

## Contrato de un perfil

```
mi-perfil/
├── profile.env      obligatorio: variables (abajo)
├── run-tests.sh     obligatorio: corre los tests y devuelve JSON
├── imports.sh       opcional: qué módulos importa un test (para check-deps)
├── staging/         opcional: plantillas que new-project.sh copia al staging (configs del runner, tests de ejemplo)
└── project/         opcional: plantillas que new-project.sh copia al repo (init.sh…); mandan sobre las genéricas
```

### `profile.env`

Lo carga el núcleo antes que `project.env`, así que el proyecto puede pisar cualquier valor.

| Variable | Qué | Ejemplo (Node) |
|---|---|---|
| `INSTALL_CMD` | instala dependencias en el worktree limpio de verificación. Vacío = nada | `npm ci --ignore-scripts --no-audit --no-fund` |
| `TYPECHECK_CMD` | tiene que salir con 0 para que una vuelta cuente. Vacío = nada | `npx tsc --noEmit` |
| `SERVE_CMD` | levanta la app para el evaluador; recibe `$PORT` | `npx vite build && npx vite preview --port "$PORT" --strictPort` |
| `BUILD_TOOLS` | comandos extra que puede lanzar el constructor, en sintaxis de `--allowedTools` y separados por comas | `Bash(npm run *),Bash(npx vitest *),…` |
| `TRAP_PATHS` | dónde buscar trampas | `src` |
| `TRAP_PATTERNS` | regex (ERE) de código que detecta que lo están probando | `process\.env\.(VITEST\|NODE_ENV)\|navigator\.webdriver` |
| `REQUIRES` | comandos que `doctor.sh` comprueba que existen | `node npx` |
| `GITIGNORE` | entradas que `new-project.sh` añade al `.gitignore` del repo | `node_modules dist test-results` |

El constructor ya tiene siempre la base común: `Read`, `Edit`, `Write`, `Grep`, `Glob`, git (status, diff, log, show, add, commit), `ls`, `./init.sh` y `check.sh`. Las trampas genéricas (`.oracle`, `TODO`, `FIXME`, `placeholder`) también se buscan siempre.

### `run-tests.sh <dir> <MH-XX>...`

- `<dir>` es un checkout del repo que ya tiene los tests en `<dir>/.oracle/` (una copia de `staging/mirror/`).
- Recibe en el entorno `FEATURES` (la ruta de `feature_list.json`) y `ORACLE`. De ahí saca `verify.file` y `verify.kind` de cada feature.
- Imprime **un objeto JSON** por stdout:
  ```json
  {"MH-07": {"passed": 12, "failed": 0, "skipped": 0, "errors": []},
   "MH-10": {"passed": 30, "failed": 1, "skipped": 0, "errors": ["nombre del test: mensaje"]}}
  ```
- **No decide qué es "ok"**: lo decide el núcleo (`core/bin/normalize.jq`). Hace falta al menos un test pasado, ninguno fallido ni saltado y ningún error. Una feature que no aparece en el JSON falla.
- Que los tests fallen no es un error del script: cuéntalo en el JSON. El código de salida se ignora; si lo que imprime no es JSON, el núcleo da todas las features por falladas.
- Mete en `errors` el mensaje útil (assertion, diff o stack corto): el constructor lo recibe en la siguiente vuelta.

### `imports.sh <fichero de test>` (opcional)

Imprime los módulos de la app que importa ese test, uno por línea, **en el mismo formato que `provides`** de `feature_list.json`. Sin él, `check-deps.sh` no puede cazar dependencias que faltan por lo que usan los tests: solo revisa el grafo.

## Cómo probar un perfil nuevo

1. `tests/profile-toy/` es el perfil mínimo (tests en bash) que usan los tests del núcleo: es la referencia más corta.
2. Crea un proyecto de prueba con `new-project.sh`, escribe 2 o 3 tests y comprueba con `try-tests.sh` que fallan contra el repo vacío y pasan contra una implementación.
3. Congela con `FREEZE_NOROOT=1 MUSTHAVE_HOME=/tmp/x` (sin sudo) y lanza `MAX_ITER=2 loop.sh` antes de usarlo en serio.
