import type { Page } from '@playwright/test';

const DEFAULT_ENV =
  process.env.VITE_ENV_HANDLE?.trim() || 'e-zt0psk82q3bi';

export function demoConfigSearch(): string {
  return `?env=${DEFAULT_ENV}&app=1&org=1`;
}

export async function gotoWithConfig(page: Page, path: string): Promise<void> {
  await page.goto(`${path}${demoConfigSearch()}`);
}
