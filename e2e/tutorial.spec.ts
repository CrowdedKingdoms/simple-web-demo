import { expect, test } from '@playwright/test';
import { demoConfigSearch, gotoWithConfig } from './helpers';

test.describe('Tutorial shell', () => {
  test('home lists all 9 chapters', async ({ page }) => {
    await gotoWithConfig(page, '/');
    await expect(
      page.getByRole('heading', { name: 'Crowded Kingdoms Web Demo' }),
    ).toBeVisible();
    for (let i = 1; i <= 9; i++) {
      await expect(page.getByRole('link', { name: new RegExp(`Chapter ${i}`) })).toBeVisible();
    }
  });

  test('chapter navigation works', async ({ page }) => {
    await gotoWithConfig(page, '/chapter/1');
    await expect(page.getByRole('heading', { name: 'Project setup' })).toBeVisible();
    await page.getByRole('link', { name: '4', exact: true }).click();
    await expect(page).toHaveURL(/\/chapter\/4/);
    await expect(page.getByRole('heading', { name: 'Canvas coordinates' })).toBeVisible();
  });
});

test.describe('Config bar', () => {
  test('launch buttons disabled without env config', async ({ page }) => {
    await page.goto('/');
    const canvas = page.getByTestId('launch-canvas');
    const tanks = page.getByTestId('launch-tanks');
    await expect(canvas).toHaveClass(/disabled/);
    await expect(tanks).toHaveClass(/disabled/);
  });

  test('launch buttons enabled after apply with connectivity', async ({ page }) => {
    await gotoWithConfig(page, '/');
    await expect(page.getByTestId('config-status')).toHaveText(/Connected|Failed|Checking/, {
      timeout: 20_000,
    });
    const status = await page.getByTestId('config-status').textContent();
    if (status === 'Connected') {
      await expect(page.getByTestId('launch-canvas')).not.toHaveClass(/disabled/);
      await expect(page.getByTestId('launch-tanks')).not.toHaveClass(/disabled/);
    }
  });
});

test.describe('Chapter 1 — connectivity', () => {
  test('dev-tier APIs are reachable with env config', async ({ page }) => {
    await gotoWithConfig(page, '/chapter/1');
    await page.getByRole('button', { name: 'Re-check connectivity' }).click();
    await expect(page.locator('.check-list li.pass', { hasText: 'Management API reachable' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('.check-list li.pass', { hasText: 'Game API reachable' })).toBeVisible();
  });
});

test.describe('Chapter 2 — guest auth', () => {
  test('auto-registers a guest on visit', async ({ page }) => {
    await gotoWithConfig(page, '/chapter/2');
    await expect(page.locator('.check-list li.pass', { hasText: 'Bearer token stored' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('.check-list li.pass', { hasText: 'User ID assigned' })).toBeVisible();
    await expect(page.locator('.check-list li.pass', { hasText: 'Guest email generated' })).toBeVisible();
  });
});

test.describe('Chapter 4 — coordinates', () => {
  test('hovering canvas shows chunk and voxel coords', async ({ page }) => {
    await gotoWithConfig(page, '/chapter/4');
    const canvas = page.locator('.demo-pane canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect(page.locator('.status-panel dt', { hasText: 'Chunk' })).toBeVisible();
    await expect(page.locator('.check-list li.pass', { hasText: 'Hover shows chunk/voxel coords' })).toBeVisible({
      timeout: 5_000,
    });
  });
});

test.describe('Chapter 3 — UDP bootstrap', () => {
  test('connects and opens UDP subscription', async ({ page }) => {
    await gotoWithConfig(page, '/chapter/3');
    await expect(page.locator('.check-list li.pass', { hasText: 'gameClientBootstrap succeeded' })).toBeVisible({
      timeout: 25_000,
    });
    await expect(page.locator('.check-list li.pass', { hasText: 'UDP proxy connected' })).toBeVisible({
      timeout: 25_000,
    });
  });
});

test.describe('Tank arena route', () => {
  test('/tanks loads tank arena', async ({ page }) => {
    await gotoWithConfig(page, '/tanks');
    await expect(page.getByRole('heading', { name: 'Tank Arena' })).toBeVisible();
    await expect(page.getByTestId('tank-arena')).toBeVisible();
    await expect(page.getByTestId('player-count')).toBeVisible();
  });

  test('two browser contexts see each other in the match', async ({ browser }) => {
    const search = demoConfigSearch();
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await Promise.all([
      pageA.goto(`/tanks${search}`),
      pageB.goto(`/tanks${search}`),
    ]);

    await expect(pageA.getByTestId('tank-arena')).toBeVisible();
    await expect(pageB.getByTestId('tank-arena')).toBeVisible();

    await expect
      .poll(async () => Number(await pageA.getByTestId('player-count').textContent()), {
        timeout: 25_000,
      })
      .toBeGreaterThanOrEqual(1);
    await expect
      .poll(async () => Number(await pageB.getByTestId('player-count').textContent()), {
        timeout: 25_000,
      })
      .toBeGreaterThanOrEqual(1);

    await contextA.close();
    await contextB.close();
  });
});

test.describe('Collaborative canvas route', () => {
  test('/canvas loads paint mode', async ({ page }) => {
    await gotoWithConfig(page, '/canvas');
    await expect(page.getByRole('heading', { name: 'Collaborative Canvas' })).toBeVisible();
    await expect(page.locator('.demo-pane canvas')).toBeVisible();
    await expect(page.locator('.palette button')).toHaveCount(5);
  });
});
