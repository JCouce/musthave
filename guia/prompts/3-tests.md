# Prompt: escribir y validar los tests del oráculo (uno por bloque de MH)

Lanza un agente por bloque de MUST-HAVEs relacionados (en fast-reading fueron 4 en paralelo). Sustituye <p>, <bloque>
y las rutas.

---

Escribe los tests de aceptación de <bloque: MH-03, MH-04, MH-05…> del proyecto <p>.

Contexto: requisitos en `<repo>/MUST_HAVES.md`, interfaz en `<repo>/docs/CONTRACT.md`. Los tests van en
`~/.musthave/<p>/staging/mirror/` (mira la config del runner que ya hay ahí) y los fixtures en `mirror/fixtures/`.
Un constructor que no ve estos tests hasta que están congelados implementará el código para pasarlos: lo que
no pruebes no existirá, y lo que pruebes mal se implementará mal.

Reglas:
- Un fichero por MH con el id en el nombre (`mh-04.test.ts`) y cada test empieza por `[MH-04]`.
- Importa solo lo que hay en el contrato. Los e2e localizan por `data-testid`.
- Cubre los casos límite del requisito y los números exactos. Prefiere muchos casos pequeños a uno grande.
- Datos reales [G]: anclados a lo que hay de verdad (inspecciónalo con herramientas) y nada de saltarlos: un test
  saltado cuenta como fallo.
- Fixtures sintéticos: guarda el generador junto a ellos.
- Si un requisito es ambiguo o no se puede probar con el contrato, no lo inventes: apúntalo en tu respuesta.

Validación obligatoria antes de dar el bloque por bueno (en copias desechables, nunca en el repo de verdad):
1. `<MH>/core/bin/try-tests.sh <p> <repo> <ids>` → todo FALLA contra el esqueleto vacío.
2. Escribe una implementación de referencia en `git worktree add /tmp/ref-<bloque>` y
   `try-tests.sh <p> /tmp/ref-<bloque> <ids>` → todo PASA.
3. Al menos 3 mutantes por MH (cambia un umbral, quita un caso límite, invierte una condición…) → cada uno
   tiene que hacer FALLAR algún test. Si un mutante pasa, añade el test que lo caza.

Devuelve: ficheros creados, nº de tests por MH, resultado de los 3 controles (con los mutantes que probaste) y
los requisitos dudosos. Además, para `feature_list.json`: las dependencias reales de cada MH, incluidas las que
salen de lo que importan sus tests, y los módulos de los que es dueña (`provides`).
