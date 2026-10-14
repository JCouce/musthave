---
name: musthave
description: Guía paso a paso del método MUST-HAVE (bucle Ralph con oráculo congelado) para construir un proyecto entero a partir de una lista de requisitos. Usar cuando el usuario invoque "/musthave", pregunte cómo repetir "el proceso del bucle", "lo de los MUST-HAVEs", "el oráculo", o quiera arrancar, retomar o diagnosticar un proyecto de ese método.
---

# musthave

Método y harness viven en un repo aparte. Su ruta está en `~/.musthave/config.env` (`MUSTHAVE_REPO=…`); los datos de cada proyecto, en `$MUSTHAVE_HOME/<proyecto>/` (por defecto `~/.musthave`). Si no existe el config, dile al usuario que ejecute `<repo>/skill/install.sh` y para.

## Qué hacer al invocarla

1. Lee `$MUSTHAVE_REPO/GUIA.md` entera. Es la fuente de verdad: no improvises pasos que no estén ahí. Si hace falta, `LECCIONES.md` y `ejemplo/fast-reading/`.
2. Averigua en qué fase está el usuario, sin preguntar lo que puedes mirar:
   - `ls $MUSTHAVE_HOME` → proyectos existentes.
   - Por proyecto: ¿hay `staging/`? ¿`oracle/` congelado? ¿`state/status.json` con verdes? ¿`state/lock.pid` con un proceso vivo? ¿`decisions/*.md` pendientes en el repo? ¿Última línea de `state/loop.log`?
   - `$MUSTHAVE_REPO/core/bin/doctor.sh <proyecto>` lo resume casi todo.
3. Dile en qué fase está y cuál es el siguiente paso de la guía, con el comando exacto.
4. Acompáñale fase a fase. Al final de cada fase, comprueba su "Listo cuando" antes de pasar a la siguiente.

## Reglas

- Los pasos con `sudo` (congelar el oráculo) los ejecuta el usuario en su terminal: dale el comando copiado, no lo lances tú.
- El bucle (`loop.sh`) también lo lanza el usuario en su terminal, con `caffeinate`: tarda horas y no debe depender de esta sesión.
- Nunca edites `oracle/` ni `state/status.json` a mano. Para devolver intentos: `core/bin/unblock.sh`. Para cambiar tests o dependencias: edita `staging/` y recongela.
- Escribir los MUST-HAVEs, el contrato y los tests es trabajo de diseño: propón y espera luz verde antes de escribir cada pieza, como con cualquier tarea nueva.
