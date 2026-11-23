import { test, expect, type ViewportSize } from '@playwright/test';

test.describe('RevenueChart Visual Regression @visual', () => {
  const viewports: Record<string, ViewportSize> = {
    'extra-small': { width: 320, height: 667 },
    'small': { width: 375, height: 667 },
    'tablet': { width: 768, height: 1024 },
    'desktop': { width: 1024, height: 800 },
  };

  const mockRevenueData = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (11 - i));
    return {
      month: date.toLocaleString('default', { month: 'short', year: '2-digit' }),
      revenue: 5000 + Math.random() * 15000,
      date: date.toISOString().split('T')[0],
    };
  });

  const mockDashboard = {
    success: true,
    data: {
      totalRevenue: 120000,
      totalEnrollments: 342,
      totalCourses: 5,
      revenueData: mockRevenueData,
    },
  };

  test.beforeEach(async ({ context, page }) => {
    // /dashboard/* is gated by middleware on the session cookie
    await context.addCookies([
      { name: 'sorobanlard_token', value: 'visual-test-token', url: 'http://localhost:3001' },
    ]);

    await page.route('**/api/v1/instructor/dashboard*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDashboard),
      });
    });

    await page.route('**/api/v1/instructor/revenue*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDashboard),
      });
    });
  });

  for (const [viewportName, viewportSize] of Object.entries(viewports)) {
    test(`revenue chart renders correctly at ${viewportName} viewport (${viewportSize.width}x${viewportSize.height})`, async ({
      page,
    }) => {
      await page.setViewportSize(viewportSize);

      await page.goto('/dashboard/instructor');
      await page.waitForLoadState('networkidle');

      await page.waitForSelector('[class*="chart"], [class*="revenue"]', { state: 'visible', timeout: 10000 }).catch(() => {});

      await page.waitForTimeout(1500);

      const suffix = `${viewportName}-${viewportSize.width}x${viewportSize.height}`;
      await expect(page).toHaveScreenshot(`revenue-chart-${suffix}.png`, {
        fullPage: false,
        animations: 'disabled',
      });
    });
  }
});
