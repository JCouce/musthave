# AGENT.md — cómo trabajar en este repo

- Stack: …  Interfaz exigida: `docs/CONTRACT.md`. Requisitos: `MUST_HAVES.md`.
- Instalar / typecheck / build / dev: …
- Tests de aceptación (oráculo): `{{ORACLE}}/bin/check.sh MH-XX [MH-YY…]` desde la raíz del repo.
  Copia los tests a `.oracle/` (ignorado por git) y los ejecuta. Editarlos no sirve: la verificación usa los originales.
- Smoke: `./init.sh`.
- Decisiones de producto pendientes: `decisions/<MH>.md`. Respondidas: `decisions/answered/`.

## Notas aprendidas
<!-- El constructor apunta aquí trucos útiles para las siguientes sesiones. -->
