# Prompt: de la toma de requisitos a `MUST_HAVES.md`

Pégaselo a Claude en el repo del proyecto, con la toma de requisitos adjunta o pegada.

---

Convierte esta toma de requisitos en `MUST_HAVES.md` siguiendo la plantilla que ya hay en el repo.

Reglas:
- Cada MUST-HAVE es una promesa **comprobable**. Para cada uno di cómo se comprueba: [U] test unitario, [E] e2e,
  [R] rúbrica que un QA comprueba en el navegador, [G] test con datos reales. Si no se te ocurre cómo comprobarlo,
  reescríbelo hasta que se pueda o propón sacarlo.
- Números concretos siempre que existan (tiempos, límites, umbrales, recuentos). Nada de "rápido" ni "bien".
- Casos límite explícitos y lo que NO se pide, para que nadie lo invente.
- Si hay datos reales (ficheros, APIs), inspecciónalos con herramientas antes de escribir los requisitos que dependen
  de ellos, y ancla esos requisitos a lo que ves (recuentos exactos, casos raros reales).
- Ids estables MH-N. Lo que no entra en esta versión va a "Fuera de esta versión", con su motivo.

Antes de escribir el fichero, enséñame la lista de títulos con su tipo de comprobación y las dudas de producto
que veas, para que decida yo.
