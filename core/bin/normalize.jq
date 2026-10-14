# Normaliza la salida de run-tests.sh de un perfil. El núcleo decide qué es "ok", no el perfil:
# al menos un test pasado, ninguno fallido ni saltado y sin errores. Una feature sin resultados falla.
# Entrada: lo que imprimió el perfil. $ARGS.positional: ids pedidos.
(if type == "object" then . else {} end) as $r
| reduce $ARGS.positional[] as $f ({};
    .[$f] = (($r[$f] // {passed: 0, failed: 0, skipped: 0, errors: ["el perfil no devolvió resultados para \($f)"]})
      | {passed: (.passed // 0), failed: (.failed // 0), skipped: (.skipped // 0), errors: ((.errors // [])[:8])}
      | .ok = (.passed > 0 and .failed == 0 and .skipped == 0 and (.errors | length) == 0)))
