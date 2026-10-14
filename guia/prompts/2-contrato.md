# Prompt: contrato de la API que exigirán los tests

---

Con `MUST_HAVES.md`, escribe `docs/CONTRACT.md` siguiendo la plantilla del repo. Es la interfaz que importarán los
tests de aceptación, que se escriben ANTES que el código.

- Por cada módulo: ruta, firma exacta (tipos incluidos), comportamiento y casos límite, y entre paréntesis las MH que
  lo exigen. La primera MH de la lista es la dueña (la que lo implementa).
- Tipos compartidos en un único módulo.
- Si hay UI: tabla de `data-testid` con lo que es cada uno; los e2e localizan solo por ahí.
- Atajos de teclado, puertos y cómo se sirve la app para los e2e.
- Las trampas conocidas de los datos o las librerías que ya sepas.
- Lo que no está en el contrato es libre: no fijes estructura interna.

Comprueba al final que cada MH [U]/[G] se puede probar importando solo cosas del contrato y que cada MH [E] solo
necesita testids del contrato. Lista lo que no cuadre.
