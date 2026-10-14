// EJEMPLO de e2e: bórralo y escribe los tuyos. Localiza por data-testid del contrato, nunca por texto o CSS.
import { test, expect } from '@playwright/test';

test('[MH-02] la página carga y muestra el título', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('title')).toBeVisible();
});
