# musthave

Método y harness para que Claude Code construya un proyecto entero a partir de una lista de **MUST-HAVEs**, en bucle y sin supervisión, hasta que se cumplen todos. Lo que decide si se cumplen no es el agente, sino tests congelados que no puede tocar, un QA independiente en el navegador y una puerta final sobre el mismo commit.

Es un bucle Ralph (`while` + `claude -p` con sesiones limpias) con tres defensas contra el *reward hacking*:

- **Oráculo de root**: los tests de aceptación se escriben antes que el código, se validan con mutantes y se congelan en una carpeta de root con hashes. El constructor trabaja con una copia; la verificación usa los originales en un worktree limpio.
- **Evaluador separado**: otro `claude -p`, sin Bash ni edición, que solo ve la app en un navegador y puntúa una rúbrica.
- **Puerta final**: todo verde → se vuelve a pasar todo sobre el mismo SHA, se comprueban los hashes y el evaluador repasa todas las rúbricas.

Probado de punta a punta en un proyecto real: 31 MUST-HAVEs, 260 tests, 1 h 15 min de bucle y menos del 8 % del cupo semanal de un plan Max ([LECCIONES.md](LECCIONES.md)).

## Empieza aquí

| Si quieres… | Lee |
|---|---|
| hacer un proyecto nuevo con el método | **[GUIA.md](GUIA.md)**: fases 0 a 9 con comandos y "listo cuando" |
| que Claude te guíe | `skill/install.sh` y luego `/musthave` en Claude Code |
| ver un caso real completo | [ejemplo/fast-reading/](ejemplo/fast-reading/) |
| saber qué salió mal y qué costó | [LECCIONES.md](LECCIONES.md) |
| usarlo con otro stack | [profiles/README.md](profiles/README.md) |

## Arranque rápido

```sh
brew install jq coreutils bats-core
skill/install.sh                                     # skill /musthave
core/bin/doctor.sh --smoke                           # ¿está todo?
core/bin/new-project.sh mi-app ~/code/mi-app         # repo + staging con plantillas
# … requisitos, contrato, tests y feature_list (GUIA.md, fases 1-4) …
core/bin/check-deps.sh mi-app
sudo core/bin/freeze.sh mi-app
caffeinate -i ~/.musthave/mi-app/oracle/bin/loop.sh 2>&1 | tee -a ~/.musthave/mi-app/state/loop.log
```

## Qué hay en el repo

```
core/bin/          el núcleo, sin dependencias de stack (bash 3.2 + jq)
  loop.sh            el bucle: siguiente feature → constructor → verify → evaluador → record
  verify.sh          worktree limpio en HEAD + instalación + typecheck + trampas + tests del oráculo
  final-gate.sh      hashes + verify ALL en el mismo SHA + evaluador en todas las rúbricas
  claude-build.sh    el constructor (claude -p, herramientas acotadas)
  claude-eval.sh     el evaluador (claude -p --restricted, solo Read + navegador, salida con --json-schema)
  record.sh next.jq  estado (solo record.sh escribe status.json) y elección de la siguiente feature
  freeze.sh          congela staging + núcleo + perfil en oracle/ (root, hashes)
  check-deps.sh      revisa feature_list: ciclos, dependencias que faltan, módulos sin dueña…
  try-tests.sh       pasa los tests del staging contra cualquier carpeta (validar con referencia y mutantes)
  new-project.sh     crea staging y plantillas para un proyecto
  doctor.sh          comprueba máquina y proyecto
  unblock.sh         devuelve intentos a features bloqueadas
  report.sh          estado y consumo (tokens y coste equivalente en API)
core/prompts/      prompts del constructor y del evaluador, esquema del veredicto y config del MCP del navegador
profiles/          adaptadores de stack (hoy: node-vitest-playwright)
templates/         plantillas genéricas de repo (MUST_HAVES, CONTRACT, AGENT…) y de staging
guia/prompts/      prompts para las fases de diseño: requisitos, contrato y tests
ejemplo/           fast-reading: requisitos, contrato, feature_list, tests, rúbricas, log y resultados
skill/             la skill /musthave para Claude Code
tests/             los tests del núcleo (bats) con un claude falso y un perfil de juguete
```

## Requisitos

macOS o Linux con bash, git, jq, rsync, shasum, curl y lsof. `gtimeout`/`timeout` recomendado. Claude Code con login de suscripción (el bucle quita `ANTHROPIC_API_KEY` para no gastar API). `sudo` solo para congelar.

Los tests del núcleo: `cd tests && bats harness.bats`.
