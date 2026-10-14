# Lecciones

Lo aprendido aplicando el método de verdad. Añade una sección por proyecto.

---

## fast-reading (octubre 2026)

Lector RSVP de PDFs en el navegador: Vite + TypeScript + pdf.js, con 31 MUST-HAVEs y 260 tests de aceptación (unitarios, e2e y con un libro real de 220 páginas). Material completo en [ejemplo/fast-reading/](ejemplo/fast-reading/).

### Números

| | |
|---|---|
| Resultado | 31/31 en verde y puerta final pasada a la primera |
| Tiempo de bucle | 1 h 15 min de reloj (9 min la primera tanda + 63 min la segunda) |
| Vueltas | 34 del constructor, 15 del evaluador |
| Intentos fallidos | 1 (MH-15) + 2 por un error mío de dependencias (MH-04) |
| Tokens | 25,4 M de entrada (casi todo caché) y 166 k de salida |
| Coste equivalente en API | 17,21 $ (16,53 constructor, 0,68 evaluador) |
| Cupo real del plan Max | **menos del 8 % del semanal** |
| Lo más lento | MH-15 (persistencia al recargar, 2.º intento: 17 min), MH-28 (primera UI: 15 min), MH-05 (párrafos: 4 min). El resto, 30-90 s |

El gasto no es lineal: las features de UI y las de heurísticas sobre datos reales se comen la mayor parte. Más e2e = bastante más cupo.

### 1. Las dependencias tienen que incluir lo que usan los tests

**Qué pasó:** MH-04 (guiones de corte) tenía tests `[G]` que llaman a `extractBook` sobre el libro real. `extractBook` es trabajo de MH-03. Puse MH-04 dependiendo solo de MH-07, y además MH-03 dependiendo de MH-04. El constructor hizo bien la parte unitaria, vio que los tests del libro necesitaban el extractor entero y, en vez de meterlo dentro de MH-04 o de hacer trampa, dejó `decisions/MH-04.md` con tres opciones. El bucle paró con exit 3.

**Arreglo:** MH-03 → `[MH-07]` y MH-04 → `[MH-07, MH-03]`, contestar la decisión, recongelar y devolver los intentos.

**Lo que hay ahora:** el campo `provides` y `check-deps.sh`, que lo detecta antes de congelar (y `freeze.sh` se niega a congelar). Al pasarlo después sobre fast-reading encontró **dos dependencias más** que faltaban (MH-08 usa `ingest` de MH-01 y MH-12 usa `tokenize` de MH-10). Funcionaron solo porque el orden de prioridad las puso detrás por casualidad.

### 2. El evaluador separado se paga solo

Gasta el 4 % del total. En MH-15, los tests e2e pasaban, pero el evaluador cargó el PDF, avanzó, recargó y vio que volvía al principio: *"al recargar volvió a 'CAPÍTULO UNO', el principio; la posición no se restauró"*. El constructor lo arregló en el segundo intento. Sin evaluador, eso habría salido en verde.

Úsalo en las features de UI. En lógica pura no aporta nada.

### 3. Mirar los datos reales antes de escribir los requisitos

Inspeccionar el libro con `pdftotext` y pdf.js cambió tres requisitos antes de congelar:

- MH-4: la regla del guion de corte, más un test de "limitación conocida" para que nadie intente lo imposible.
- MH-8: las viñetas pasan a ser inicios de elemento de lista y las rayas se pegan a la palabra siguiente.
- MH-5: la lista exacta de párrafos que pueden empezar en minúscula.

Con números exactos ("48 títulos", "entre 42 y 49 viñetas"), el constructor sabe cuándo ha acabado.

### 4. Si no está en un test, no existe

Al probar la app faltaban ←/→, la barra de progreso y cambiar la velocidad en el móvil. Ninguna estaba en un test ni en una rúbrica. El constructor las dejó apuntadas en `progress.md` como "falta", pero no las hizo. Bien hecho por su parte: es justo lo que se le pide.

### 5. Detalles del harness que importan

- **`--allowedTools` no restringe nada por sí solo** en `claude -p`. Lo que restringe es `--tools` (las herramientas que existen) junto con `--permission-mode dontAsk` (lo no permitido se rechaza sin preguntar). Para el evaluador, `--restricted --tools Read` y un MCP de navegador con `--strict-mcp-config`.
- **`--json-schema`** deja la salida en `structured_output`: el veredicto del evaluador es JSON validado, no texto que haya que parsear.
- **`claude -p` no informa del cupo.** Para verlo, `/usage` o la statusline (`rate_limits.*`). El bucle detecta el 429 / "usage limit" y espera.
- **El oráculo, de root.** El bucle hace `sudo -k` al arrancar para que no quede un sudo cacheado que el constructor pueda aprovechar.
- **Bash 3.2** (el de macOS): nada de `declare -A`, `mapfile` ni `${x,,}`. Y sin `rm` en los scripts: temporales en `$TMPDIR`.
- **Puertos:** el `check.sh` del perfil Node levanta su propio `vite preview` en el 4173. Un preview tuyo en segundo plano lo rompe.
- Varias features salieron **"verificadas sin tocar código"**: ya las cubría una anterior. Gastan una vuelta corta y está bien que sea así.
- `AGENT.md` funciona: el constructor fue apuntando ahí las trampas de pdf.js y las siguientes sesiones las aprovecharon.

### 6. Lo que se descartó como motor del bucle (y por qué)

| Opción | Por qué no |
|---|---|
| `/loop` de Claude Code | Está pensado para hacer polling a intervalos, no para iterar hasta cumplir algo |
| `/goal` | Su juez solo lee el transcript: el agente puede convencerle sin que nada sea verdad |
| Plugin ralph-wiggum | Termina cuando aparece una "promise" exacta en la salida: el propio agente decide cuándo ha acabado |
| Stop hooks | Tope de 8 continuaciones y todo en una sola sesión, que acaba llena de contexto |
| **Bash + `claude -p` + oráculo de root** | Sesiones limpias, juez externo que no se puede tocar y estado en ficheros. Es lo que hay aquí |

Fuentes de la investigación inicial: Anthropic, *Effective harnesses for long-running agents* y *Building effective agents*, más sus artículos de context engineering y multi-agente; la documentación de Claude Code (headless, hooks, `/loop`, `/goal`); Geoffrey Huntley, *Ralph Wiggum as a software engineer*; OpenAI, Codex long-horizon; GitHub Spec Kit; Kiro (specs) y METR, sobre reward hacking.

---

## Validación del harness genérico (octubre 2026)

Al separar el núcleo de los perfiles, se probó con un proyecto `demo` creado desde cero con `new-project.sh` y las plantillas tal cual: 2 MUST-HAVEs (una con Vitest y otra con Playwright y rúbrica) y `claude` real.

- 2/2 en verde y puerta final pasada. 4 llamadas, 0,92 $ equivalentes, 2 minutos.
- El perfil Node, pasado sobre el código de fast-reading, da los 260 tests en verde en 15 s.
- **Comandos compuestos:** el constructor lanzó `check.sh MH-01; echo EXIT $?` y `dontAsk` lo rechazó, porque `Bash(ruta *)` no cubre comandos encadenados. Se las apañó con Vitest a pelo, pero el prompt del constructor ahora dice que cada comando va solo y que los ficheros se escriben con Edit/Write.
- Faltaba `test-results/` (la salida de Playwright) en el `.gitignore`: ahora cada perfil declara sus entradas (`GITIGNORE`).
