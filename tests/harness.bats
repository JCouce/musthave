#!/usr/bin/env bats
# Tests del núcleo con un claude falso y el perfil de juguete (tests en bash): no dependen de ningún stack.
# Regla de oro: ningún escenario tramposo puede acabar en exit 0.
REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"

setup() {
  T="$(mktemp -d "${TMPDIR:-/tmp}/musthave-bats.XXXXXX")"
  export MUSTHAVE_HOME="$T/home" FREEZE_NOROOT=1 WAIT_SECS=1 STALL_N=4
  mkdir -p "$T/home" "$T/bin"
  ln -s "$REPO_ROOT/tests/fake-claude" "$T/bin/claude"
  export PATH="$T/bin:$PATH"
  # repo de juguete
  R="$T/repo"; mkdir -p "$R/src"
  (cd "$R" && git init -q && git config user.email t@t && git config user.name t \
    && echo 'true' >src/index.sh && printf '.oracle/\n' >.gitignore && git add -A && git commit -qm init)
  # staging de juguete: MH-01 y MH-02 posibles, MH-03 imposible
  S="$T/home/toy/staging"; mkdir -p "$S/mirror/tests" "$S/rubrics"
  printf 'PROFILE=%s\nREPO=%s\nBUILD_MODEL=fake\nEVAL_MODEL=fake\n' "$REPO_ROOT/tests/profile-toy" "$R" >"$S/project.env"
  echo 'source src/a.sh; [ "$(a)" = 1 ]' >"$S/mirror/tests/mh-01.sh"
  echo 'source src/b.sh; [ "$(b)" = 2 ]' >"$S/mirror/tests/mh-02.sh"
  echo 'source src/c.sh; [ "$(c)" = 3 ]' >"$S/mirror/tests/mh-03.sh"
  export S R T
  export FAKE_STATE="$T/home/toy/state" FAKE_CALLS="$T/calls" FAKE_FLAG="$T/flag"
}

teardown() { chmod -R u+w "$T" 2>/dev/null || true; }

features() {  # $1 = JSON con la lista de ids, sin dependencias
  jq -n --argjson ids "$1" '$ids | to_entries | map({id: .value, description: .value, priority: (.key + 1), depends_on: [], verify: {kind: "test", file: "tests/\(.value | ascii_downcase).sh"}})' >"$S/feature_list.json"
}
freeze() { "$REPO_ROOT/core/bin/freeze.sh" toy >/dev/null; }
loop() { run "$T/home/toy/oracle/bin/loop.sh"; }
passes() { jq -r --arg f "$1" '.[$f].passes' "$FAKE_STATE/status.json"; }

@test "honesto: dos features posibles → exit 0, todo verde" {
  features '["MH-01","MH-02"]'; freeze
  FAKE_MODE=honest loop
  [ "$status" -eq 0 ]
  [ "$(passes MH-01)" = true ] && [ "$(passes MH-02)" = true ]
}

@test "imposible: MH-03 acaba bloqueada → exit 3, nunca 0" {
  features '["MH-01","MH-03"]'; freeze
  FAKE_MODE=honest loop
  [ "$status" -eq 3 ]
  [ "$(passes MH-01)" = true ]
  [ "$(jq -r '.["MH-03"].blocked_reason' "$FAKE_STATE/status.json")" = max_attempts ]
}

@test "trampa: editar los tests en el repo no sirve → nunca exit 0" {
  features '["MH-01"]'; freeze
  FAKE_MODE=tamper-tests loop
  [ "$status" -ne 0 ]
  [ "$(passes MH-01)" = false ]
}

@test "trampa: falsificar status.json → la puerta final lo tumba → nunca exit 0" {
  features '["MH-01"]'; freeze
  FAKE_MODE=fake-status loop
  [ "$status" -ne 0 ]
}

@test "trampa: código que detecta que lo están probando → rechazado → nunca exit 0" {
  features '["MH-01"]'; freeze
  FAKE_MODE=detect-test loop
  [ "$status" -ne 0 ]
  grep -q 'trampa' "$FAKE_STATE/verify/MH-01.json"
}

@test "trampa: tocar el oráculo congelado → la puerta final lo detecta" {
  features '["MH-01"]'; freeze
  echo "# cambiado" >>"$T/home/toy/oracle/mirror/tests/mh-01.sh"
  FAKE_MODE=honest loop
  [ "$status" -ne 0 ]
}

@test "cupo agotado: espera y reintenta sin gastar intento → exit 0" {
  features '["MH-01"]'; freeze
  FAKE_MODE=ratelimit-once loop
  [ "$status" -eq 0 ]
  [ "$(jq -r '.["MH-01"].attempts' "$FAKE_STATE/status.json")" = 1 ]
}

@test "decisión de producto: para con exit 3" {
  features '["MH-01"]'; freeze
  FAKE_MODE=decision loop
  [ "$status" -eq 3 ]
}

@test "lock: con otro loop vivo sale con exit 6" {
  features '["MH-01"]'; freeze
  echo $$ >"$FAKE_STATE/lock.pid"
  FAKE_MODE=honest loop
  [ "$status" -eq 6 ]
}

@test "constructor que peta: no rompe el bucle, acaba bloqueada → exit 3" {
  features '["MH-01"]'; freeze
  FAKE_MODE=crash loop
  [ "$status" -eq 3 ]
}

@test "evaluador: con rúbrica se le llama y si aprueba → exit 0" {
  features '["MH-01"]'; echo '{"feature":"MH-01","criteria":[{"criterion":"se ve","threshold":1}]}' >"$S/rubrics/MH-01.json"; freeze
  FAKE_MODE=honest FAKE_EVAL=pass loop
  [ "$status" -eq 0 ]
  grep -q '^MH-01:eval$' "$FAKE_CALLS"
}

@test "evaluador: si suspende, los tests verdes no bastan → nunca exit 0" {
  features '["MH-01"]'; echo '{"feature":"MH-01","criteria":[{"criterion":"se ve","threshold":1}]}' >"$S/rubrics/MH-01.json"; freeze
  FAKE_MODE=honest FAKE_EVAL=fail loop
  [ "$status" -ne 0 ]
  [ "$(passes MH-01)" = false ]
}

@test "evaluador: sin rúbrica no se le llama" {
  features '["MH-01"]'; freeze
  FAKE_MODE=honest loop
  [ "$status" -eq 0 ]
  ! grep -q ':eval' "$FAKE_CALLS"
}

@test "check-deps: test que usa el módulo de otra feature sin depender de ella → error y freeze se niega" {
  features '["MH-01","MH-02"]'
  echo 'source src/a.sh; source src/b.sh; [ "$(b)" = 2 ]' >"$S/mirror/tests/mh-02.sh"
  jq '.[0].provides = ["src/a.sh"]' "$S/feature_list.json" >"$T/fl" && mv "$T/fl" "$S/feature_list.json"
  run "$REPO_ROOT/core/bin/check-deps.sh" toy
  [ "$status" -eq 1 ]
  [[ "$output" == *"el test de MH-02 usa src/a.sh, que hace MH-01, pero MH-02 no depende de MH-01"* ]]
  run "$REPO_ROOT/core/bin/freeze.sh" toy
  [ "$status" -eq 1 ]
  jq '.[1].depends_on = ["MH-01"]' "$S/feature_list.json" >"$T/fl" && mv "$T/fl" "$S/feature_list.json"
  run "$REPO_ROOT/core/bin/check-deps.sh" toy
  [ "$status" -eq 0 ]
  [[ "$output" == *"Orden previsto: MH-01 → MH-02"* ]]
}

@test "check-deps: ciclo, dependencia inexistente y test que falta → error" {
  features '["MH-01","MH-02"]'
  jq '.[0].depends_on = ["MH-02"] | .[1].depends_on = ["MH-01","MH-99"] | .[1].verify.file = "tests/nada.sh"' "$S/feature_list.json" >"$T/fl" && mv "$T/fl" "$S/feature_list.json"
  run "$REPO_ROOT/core/bin/check-deps.sh" toy
  [ "$status" -eq 1 ]
  [[ "$output" == *"ciclo de dependencias en MH-01, MH-02"* ]]
  [[ "$output" == *"MH-02 depende de MH-99, que no existe"* ]]
  [[ "$output" == *"no existe el test mirror/tests/nada.sh"* ]]
}

@test "check-deps: módulo compartido sin dueña → solo aviso" {
  features '["MH-01","MH-02"]'
  echo 'source src/a.sh; [ "$(a)" = 1 ]' >"$S/mirror/tests/mh-02.sh"
  run "$REPO_ROOT/core/bin/check-deps.sh" toy
  [ "$status" -eq 0 ]
  [[ "$output" == *"AVISO: src/a.sh lo usan los tests de MH-01, MH-02"* ]]
}

@test "unblock: devuelve los intentos a una feature bloqueada" {
  features '["MH-03"]'; freeze
  FAKE_MODE=honest loop
  [ "$(jq -r '.["MH-03"].blocked_reason' "$FAKE_STATE/status.json")" = max_attempts ]
  run "$REPO_ROOT/core/bin/unblock.sh" toy MH-03
  [ "$status" -eq 0 ]
  [ "$(jq -r '.["MH-03"].blocked_reason' "$FAKE_STATE/status.json")" = null ]
  [ "$(jq -r '.["MH-03"].attempts' "$FAKE_STATE/status.json")" = 0 ]
}

@test "new-project: crea staging y plantillas sin pisar lo que ya existe" {
  mkdir -p "$T/nuevo"; echo "mío" >"$T/nuevo/AGENT.md"
  run "$REPO_ROOT/core/bin/new-project.sh" demo "$T/nuevo" node-vitest-playwright
  [ "$status" -eq 0 ]
  [ "$(cat "$T/nuevo/AGENT.md")" = "mío" ]
  [ -f "$T/nuevo/MUST_HAVES.md" ] && [ -f "$T/nuevo/docs/CONTRACT.md" ] && [ -x "$T/nuevo/init.sh" ]
  [ -d "$T/nuevo/decisions/answered" ] && [ -d "$T/nuevo/.git" ]
  grep -qx '.oracle/' "$T/nuevo/.gitignore"
  grep -q '^PROFILE=node-vitest-playwright$' "$MUSTHAVE_HOME/demo/staging/project.env"
  grep -q "^REPO=$(cd "$T/nuevo" && pwd)\$" "$MUSTHAVE_HOME/demo/staging/project.env"
  [ -f "$MUSTHAVE_HOME/demo/staging/mirror/vitest.config.mjs" ]
  [ -f "$MUSTHAVE_HOME/demo/staging/feature_list.json" ]
  run "$REPO_ROOT/core/bin/new-project.sh" demo "$T/nuevo" node-vitest-playwright
  [ "$status" -ne 0 ]
}

@test "try-tests: valida el staging sin congelar: repo vacio falla, referencia pasa, mutante falla" {
  features '["MH-01"]'
  run "$REPO_ROOT/core/bin/try-tests.sh" toy "$R" MH-01
  [ "$status" -eq 1 ]
  mkdir -p "$T/ref/src"; echo 'a() { echo 1; }' >"$T/ref/src/a.sh"
  run "$REPO_ROOT/core/bin/try-tests.sh" toy "$T/ref" ALL
  [ "$status" -eq 0 ]
  [[ "$output" == *"MH-01: OK"* ]]
  echo 'a() { echo 2; }' >"$T/ref/src/a.sh"
  run "$REPO_ROOT/core/bin/try-tests.sh" toy "$T/ref" MH-01
  [ "$status" -eq 1 ]
}
