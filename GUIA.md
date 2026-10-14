# Guía: de una lista de MUST-HAVEs a un proyecto terminado

Esta guía cubre todo el proceso, de principio a fin. Síguela en orden: cada fase acaba con un **Listo cuando** que hay que cumplir antes de pasar a la siguiente.

Si tienes Claude Code a mano, escribe `/musthave` y te lleva fase a fase (ver [Fase 0](#fase-0--instalar-una-vez-por-máquina)).

---

## La idea en 30 segundos

Un **constructor** (`claude -p`) implementa las features **de una en una** y en sesiones **sin memoria**: cada vuelta arranca limpia y lee el estado de git y de unos pocos ficheros. Para saber si ha terminado, el constructor no se juzga a sí mismo. Lo deciden tres cosas que no puede tocar:

1. **El oráculo**: tests de aceptación escritos *antes*, congelados en una carpeta que es de root. El constructor trabaja con una copia; la verificación usa los originales en un worktree limpio.
2. **El evaluador**: otro `claude -p` que no ve el código ni puede editar. Solo usa la app en un navegador y puntúa una rúbrica. Únicamente en las features que tienen rúbrica.
3. **La puerta final**: cuando todo está en verde, se vuelve a pasar **todo** sobre el mismo commit, se comprueba que el oráculo no se ha tocado (hashes) y el evaluador repasa todas las rúbricas.

Un bucle en bash (`loop.sh`) coordina todo esto: elige la siguiente feature por dependencias y prioridad, reintenta hasta 3 veces, se para si se atasca o si el constructor deja una pregunta en `decisions/`, y espera si se acaba el cupo.

```
             ┌──────────── loop.sh (bash, tú lo lanzas) ────────────┐
             │                                                      │
 status.json ─► siguiente feature ─► constructor ─► verify (worktree limpio + tests del oráculo)
             ▲                         (claude -p)        │
             │                                            ▼ si tiene rúbrica
             └──────────────── record.sh ◄──────── evaluador (claude -p + navegador)
                                                                    │ todo verde
                                                                    ▼
                                                               puerta final → TERMINADO
```

## Mapa de carpetas

| Dónde | Qué | ¿En git? |
|---|---|---|
| `<este repo>/` | El método y el harness (núcleo, perfiles, plantillas y esta guía) | sí, aquí |
| `<tu proyecto>/` | El código de la app. El constructor solo toca esto | sí, en el suyo |
| `~/.musthave/<p>/staging/` | Lo que **tú** preparas: tests, fixtures, rúbricas, lista de features y config | no (hazle copia si quieres) |
| `~/.musthave/<p>/oracle/` | El staging congelado + el harness, **de root** y de solo lectura | no |
| `~/.musthave/<p>/state/` | Estado del bucle: `status.json`, logs, verificaciones y transcripts | no |

`~/.musthave` es el valor por defecto de `MUSTHAVE_HOME`. En esta guía, `$MH` es la ruta de este repo y `<p>` el nombre del proyecto.

## Vocabulario

- **MUST-HAVE (MH-N)**: un requisito que no es negociable y que se puede comprobar.
- **Feature**: una entrada de `feature_list.json`, normalmente 1:1 con un MH. Lleva prioridad, dependencias y el fichero de test que la verifica.
- **Contrato**: `docs/CONTRACT.md`, las rutas, firmas y `data-testid` que importan los tests. El constructor tiene que respetarlo al pie de la letra.
- **Perfil**: el adaptador al stack (cómo se instala, se compila, se pasan los tests y se sirve la app). Ver [profiles/README.md](profiles/README.md).
- **Verde**: la feature pasa sus tests en un worktree limpio, y su rúbrica si la tiene. **Bloqueada**: ha gastado sus 3 intentos.

---

## Fase 0 — Instalar (una vez por máquina)

```sh
git clone <url de este repo> ~/Documents/musthave      # o donde quieras
brew install jq coreutils bats-core                    # coreutils trae gtimeout
$MH/skill/install.sh                                   # skill /musthave + ~/.musthave/config.env
$MH/core/bin/doctor.sh --smoke                         # comprueba todo; --smoke hace 2 llamadas mínimas a claude
(cd $MH/tests && bats harness.bats)                    # 19 tests del harness con un claude falso
```

Necesitas Claude Code con **login de suscripción** (`claude` → `/login`). Si `ANTHROPIC_API_KEY` está en el entorno, el bucle la quita para no gastar API, pero no la tengas exportada en el shell.

**Listo cuando:** `doctor.sh --smoke` dice `todo listo` (con `apiKeySource=none`) y los bats salen todos `ok`.

---

## Fase 1 — Requisitos: `MUST_HAVES.md`

Partes de la toma de requisitos, sea la que sea, y la conviertes en una lista de MUST-HAVEs **comprobables**. Esta es la fase que más pesa: el bucle construye exactamente lo que digan los tests, ni más ni menos.

1. Crea el proyecto (repo + staging) con las plantillas:
   ```sh
   $MH/core/bin/new-project.sh <p> ~/ruta/al/repo [perfil]     # perfil por defecto: node-vitest-playwright
   ```
2. Rellena `MUST_HAVES.md` (la plantilla trae el formato). Puedes pedírselo a Claude con [guia/prompts/1-requisitos.md](guia/prompts/1-requisitos.md).
3. Para cada MH, apunta **cómo se comprueba**: `[U]` unitario, `[E]` e2e, `[R]` rúbrica del evaluador o `[G]` con datos reales.
4. Si hay datos reales (un PDF, una API, un CSV), **míralos ya** con herramientas (`pdftotext`, `jq`, `curl`…) y pon números exactos en los requisitos ("salen 48 títulos", "0 viñetas sueltas"). En fast-reading, mirar el libro antes cambió 3 requisitos (ver [LECCIONES.md](LECCIONES.md)).
5. Saca explícitamente lo que no entra en esta versión.

**Listo cuando:** cada MH tiene su forma de comprobarse, y lo que no la tiene se ha reescrito o ha pasado a "Fuera". Regla: *si no está en un test o en una rúbrica, no existe*. En fast-reading, ←/→ y la barra de progreso no estaban en ningún test y no se hicieron.

---

## Fase 2 — Contrato: `docs/CONTRACT.md`

La interfaz que van a importar los tests: rutas de módulos, firmas exactas, tipos compartidos y la tabla de `data-testid` de la UI. Con eso, los tests se pueden escribir antes que el código.

- Por cada módulo, las MH que lo exigen entre paréntesis. **La primera es la dueña**, la que lo implementa.
- Lo que no está en el contrato es libre: estructura interna, estilos y helpers.
- Pon las trampas conocidas de los datos ("los títulos del apéndice usan la misma fuente que el cuerpo"): ahorran vueltas al constructor.

Ayuda: [guia/prompts/2-contrato.md](guia/prompts/2-contrato.md). Ejemplo real: [ejemplo/fast-reading/repo/docs/CONTRACT.md](ejemplo/fast-reading/repo/docs/CONTRACT.md).

**Listo cuando:** cada MH `[U]`/`[G]` se puede probar importando solo cosas del contrato, y cada MH `[E]` localiza la UI solo por `data-testid` del contrato.

---

## Fase 3 — Esqueleto del repo

El repo tiene que compilar **vacío** y tener instaladas las herramientas de test, porque la verificación hace `INSTALL_CMD` (con el perfil Node, `npm ci`) en un worktree limpio.

1. Stack mínimo: `package.json` con las dependencias de la app **y las de test** (con el perfil Node: `vitest`, `@playwright/test`, `typescript`), `tsconfig`, un `src/` vacío que compile y el lockfile.
2. `./init.sh` (plantilla del perfil) instala y pasa el typecheck.
3. `AGENT.md`: stack, cómo compilar y la ruta de `check.sh` (la plantilla ya la trae). El constructor apunta aquí lo que aprende.
4. `.gitignore` con `.oracle/` (lo añade `new-project.sh`) y tus datos privados.
5. Navegadores de Playwright si hay e2e o evaluador: `npx playwright install chromium`.
6. **Commit.** Apunta el SHA: es el "código a cero" al que puedes volver.

**Listo cuando:** `./init.sh` dice `init ok` y `git status` está limpio.

---

## Fase 4 — El oráculo: tests, rúbricas y `feature_list.json`

Todo esto va en `~/.musthave/<p>/staging/`:

```
staging/
├── project.env          perfil, ruta del repo, modelos y ficheros de prueba del evaluador
├── feature_list.json    una entrada por feature: id, priority, depends_on, provides, verify
├── eval.md              (opcional) qué tiene que cargar el evaluador y cómo
├── rubrics/MH-XX.json   (opcional) solo las features que el evaluador mira en el navegador
└── mirror/              lo que se copia a <repo>/.oracle: tests, fixtures y configs del runner
```

### 4.1 Escribir los tests

- Un fichero por MH, con el id en el nombre (`mh-07.test.ts`), y cada test empezando por `[MH-07]`.
- Importa solo lo del contrato. Los e2e localizan por `data-testid`.
- Los fixtures van en `mirror/fixtures/`. Si son sintéticos, guarda también el generador (como `gen.cjs` en el ejemplo).
- Un test saltado **cuenta como fallo**. Los datos reales `[G]` van dentro del oráculo, para que nunca falten.
- Con muchos MH, reparte por bloques entre varios agentes en paralelo: [guia/prompts/3-tests.md](guia/prompts/3-tests.md). En fast-reading, 4 agentes escribieron 256 tests.

### 4.2 Validar los tests (que no se te salte)

Un test que pasa con cualquier cosa no vale nada. Para cada bloque:

```sh
$MH/core/bin/try-tests.sh <p> ~/ruta/al/repo ALL        # 1. contra el repo vacío: TODO tiene que FALLAR
$MH/core/bin/try-tests.sh <p> /tmp/ref MH-07 MH-10      # 2. contra una implementación de referencia: tiene que PASAR
$MH/core/bin/try-tests.sh <p> /tmp/mutante-1 MH-07      # 3. contra mutantes de la referencia: cada uno tiene que FALLAR
```

La referencia y los mutantes se hacen en una copia desechable del repo (`git worktree add /tmp/ref`), **nunca en el repo de verdad**. Si un mutante pasa, al test le falta un caso. Los agentes que escriben los tests pueden hacer también esta validación (lo pide el prompt).

### 4.3 Rúbricas (solo UI)

Para lo que un test no ve bien (que se vea, que el flujo tenga sentido o que se pueda usar con el teclado), crea `rubrics/MH-XX.json`:

```json
{"feature":"MH-15","criteria":[{"criterion":"Tras recargar, el libro se abre solo","threshold":1}]}
```

Si hay rúbricas, define en `project.env` `EVAL_FILES` (ficheros de `mirror/` que el evaluador puede cargar) y `SERVE_CMD` si no vale el del perfil, y escribe `eval.md`. En fast-reading, el evaluador pilló un fallo de MH-15 que los tests e2e daban por bueno.

### 4.4 `feature_list.json`

```json
{ "id": "MH-04", "description": "…", "priority": 12,
  "depends_on": ["MH-07", "MH-03"], "provides": ["@/ingest/dehyphenate"],
  "verify": { "kind": "test", "file": "tests/unit/mh-04.test.ts" } }
```

- `priority`: el orden entre features listas para empezar (menor = antes).
- `depends_on`: **todo** lo que la feature necesita que exista antes, **también lo que usan sus tests**. Si los tests de MH-04 llaman a `extractBook`, MH-04 depende de quien hace `extractBook`.
- `provides`: los módulos de los que es dueña, escritos como los importan los tests. Es lo que permite a `check-deps.sh` cazar dependencias que faltan.
- `verify.kind`: lo interpreta el perfil (en Node: `test` → Vitest, `e2e` → Playwright).

### 4.5 Revisar

```sh
$MH/core/bin/check-deps.sh <p>
```

Detecta ids repetidos, dependencias que no existen, ciclos, tests que faltan, rúbricas huérfanas y **tests que usan un módulo de otra feature sin depender de ella**, que es el error que paró fast-reading. Avisa de los módulos compartidos sin dueña. Al final imprime el **orden previsto**: léelo y comprueba que tiene sentido.

**Listo cuando:** `check-deps.sh` dice `OK`, revisas los avisos uno a uno, cada bloque de tests ha pasado el triple control de 4.2 y el orden previsto tiene sentido.

---

## Fase 5 — Congelar

```sh
sudo $MH/core/bin/freeze.sh <p>           # en TU terminal: pide contraseña
$MH/core/bin/doctor.sh <p>                # oráculo de root, hashes OK, staging = congelado
```

`freeze.sh` vuelve a pasar `check-deps` y se niega a congelar si hay errores. Copia el staging, el núcleo y el perfil a `oracle/`, calcula los hashes, lo pone todo de root y crea `state/status.json` con todo en rojo. Si ya había un oráculo, lo aparta a `oracle.prev.<fecha>`.

**Listo cuando:** `doctor.sh <p>` sale sin fallos.

---

## Fase 6 — Vuelta de prueba

Una sola vuelta, para ver que todo engrana y cuánto cuesta una vuelta:

```sh
MAX_ITER=1 $MUSTHAVE_HOME/<p>/oracle/bin/loop.sh      # sale con 4 (tope) tras una vuelta: es lo esperado
$MUSTHAVE_HOME/<p>/oracle/bin/report.sh               # estado y consumo
```

Mira `state/loop.log`, el commit que ha hecho en el repo y `state/runs/001-*-build.json`. En fast-reading, la primera vuelta tardó 34 s y salió en verde. La feature que acaba en verde se queda en verde.

**Listo cuando:** la vuelta acaba con un commit del constructor y la feature en verde. Si sale en rojo, lee `state/verify/MH-XX.json`: suele ser un test mal planteado o algo que falta en el contrato (vuelve a la fase 4).

---

## Fase 7 — Lanzar el bucle

En **tu** terminal, no dentro de Claude Code, porque tarda horas:

```sh
caffeinate -i $MUSTHAVE_HOME/<p>/oracle/bin/loop.sh 2>&1 | tee -a $MUSTHAVE_HOME/<p>/state/loop.log
```

Para seguirlo desde otra terminal:

```sh
tail -f $MUSTHAVE_HOME/<p>/state/loop.log
$MUSTHAVE_HOME/<p>/oracle/bin/report.sh
```

Topes por defecto, ajustables como variables de entorno al lanzar:

| Variable | Defecto | Qué |
|---|---|---|
| `MAX_ITER` | 3×features+10 | vueltas totales |
| `MAX_ATTEMPTS` | 3 | intentos por feature antes de bloquearla |
| `STALL_N` | 8 | vueltas seguidas sin nuevos verdes → atascado |
| `WAIT_SECS` / `MAX_WAITS` | 900 / 48 | espera cuando se acaba el cupo (hasta 12 h) |
| `BUILD_TIMEOUT` / `EVAL_TIMEOUT` | 45m / 20m | tope de una vuelta del constructor / del evaluador |

Si el build se rompe dos vueltas seguidas, el bucle hace `git reset --hard` al último commit verde.

---

## Fase 8 — Cuando el bucle se para

| Exit | Qué significa | Qué haces |
|---|---|---|
| **0** | `TERMINADO`: la puerta final ha pasado | Fase 9 |
| **3** | Hay `decisions/*.md` en el repo **o** todo lo pendiente está bloqueado | ver abajo |
| **4** | Tope de vueltas | `report.sh`. Si avanzaba, relanza con más `MAX_ITER` |
| **5** | Atascado: `STALL_N` vueltas sin nuevos verdes | lee los últimos `state/verify/*.json` y el log; suele ser un test o un contrato mal planteado |
| **6** | Ya hay otro bucle corriendo, o se han agotado las esperas de cupo | `cat state/lock.pid` / mira tu cupo con `/usage` |

### Exit 3 con una decisión

El constructor ha dejado una pregunta en `<repo>/decisions/MH-XX.md`, con opciones y su recomendación. Es lo que tiene que hacer cuando algo no cuadra, en vez de hacer trampa.

1. Léela. Si es de producto, contéstala debajo en el mismo fichero.
2. Muévela a `decisions/answered/` y haz commit en el repo.
3. Si el problema era del oráculo (una dependencia que falta o un test mal planteado): arregla el **staging** → `check-deps.sh` → `sudo freeze.sh` → `unblock.sh` (abajo).
4. Relanza (fase 7).

### Exit 3 con features bloqueadas

Han gastado los 3 intentos. Mira por qué en `state/verify/MH-XX.json`, en `state/eval/MH-XX/last.json` (veredicto del evaluador) y en `state/runs/*-MH-XX-build.json` (lo que dijo el constructor). Arregla la causa (test, contrato, dependencias o pista en `AGENT.md`) y devuélvele los intentos:

```sh
$MH/core/bin/unblock.sh <p> MH-XX [MH-YY…]
```

### Cambiar el oráculo a mitad

Edita `staging/` → `check-deps.sh` → `sudo freeze.sh <p>` → relanza. Los verdes se mantienen y las features nuevas entran en rojo. Si cambias el test de una feature ya verde, se reverifica sola en la siguiente vuelta (cada verificación repasa también todas las verdes) y, en cualquier caso, en la puerta final.

**Nunca** edites `oracle/` ni `state/status.json` a mano.

---

## Fase 9 — Cerrar

1. Lee el final de `state/loop.log` (`TERMINADO`) y `report.sh`: tokens por rol y coste equivalente en API.
2. **Pruébala tú**: lo que no estaba en los tests no existe. Apunta lo que falte como MUST-HAVEs de una versión 2 y vuelve a la fase 1 con el mismo proyecto.
3. Lee `progress.md`: el constructor apunta en cada línea "qué queda raro". Ahí salen las limitaciones conocidas.
4. Limpia el repo para publicarlo si quieres (README, sacar `progress.md`/`decisions/` a `docs/`…). `.oracle/` ya está ignorado.
5. Apunta en [LECCIONES.md](LECCIONES.md) lo que hayas aprendido.

---

## Chuleta

```sh
MH=~/Documents/musthave; P=mi-proyecto; O=~/.musthave/$P/oracle; S=~/.musthave/$P/state
$MH/core/bin/doctor.sh $P                       # ¿cómo está todo?
$MH/core/bin/new-project.sh $P ~/repo           # empezar
$MH/core/bin/try-tests.sh $P <dir> ALL          # validar tests antes de congelar
$MH/core/bin/check-deps.sh $P                   # revisar dependencias
sudo $MH/core/bin/freeze.sh $P                  # congelar (tu terminal)
MAX_ITER=1 $O/bin/loop.sh                       # vuelta de prueba
caffeinate -i $O/bin/loop.sh 2>&1 | tee -a $S/loop.log   # lanzar (tu terminal)
$O/bin/report.sh                                # estado y consumo
$MH/core/bin/unblock.sh $P MH-XX                # devolver intentos
cd <repo> && $O/bin/check.sh MH-XX              # pasar los tests de una feature a mano
```
