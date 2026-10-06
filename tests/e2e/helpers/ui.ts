import { expect, type Page } from "@playwright/test";
import { DEMO_PASSWORD, ROLE_EMAILS, type Role } from "./api";

/** Autentica pela interface como o perfil informado e confirma a saída do login. */
export async function loginAs(page: Page, role: Role): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ROLE_EMAILS[role]);
  await page.getByLabel("Senha").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

/**
 * Navega pelo item de sidebar correspondente à rota, exercitando a navegação
 * real em vez de `page.goto`, e confirma o título da página.
 */
export async function openModule(
  page: Page,
  href: string,
  heading: string | RegExp,
): Promise<void> {
  await page.locator(`a[href="${href}"]`).first().click();
  await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
}

/** Segue um link de deep link visível na página e confirma a URL resultante. */
export async function followLink(page: Page, pattern: RegExp): Promise<void> {
  await page.locator(`a[href]`).filter({ hasText: pattern }).first().click();
  await expect(page).toHaveURL(pattern);
}
