import { test, expect, type ViewportSize } from '@playwright/test';

test.describe('FilterSidebar Visual Regression @visual', () => {
  const viewports: Record<string, ViewportSize> = {
    'extra-small': { width: 320, height: 667 },
    'small': { width: 375, height: 667 },
    'tablet': { width: 768, height: 1024 },
    'desktop': { width: 1024, height: 800 },
  };

  const mockCategories = [
    { name: 'Web Development', count: 12 },
    { name: 'Tailoring', count: 8 },
    { name: 'Makeup Artistry', count: 6 },
    { name: 'Baking', count: 5 },
    { name: 'Photography', count: 9 },
  ];

  const mockCourses = {
    success: true,
    data: Array.from({ length: 12 }, (_, i) => ({
      id: `course-${i}`,
      title: `Test Course ${i + 1}`,
      category: mockCategories[i % mockCategories.length].name,
      level: ['Beginner', 'Intermediate', 'Advanced'][i % 3],
      price: 29.99 + i * 10,
      rating: 4 + Math.random(),
      reviewCount: 50 + i * 10,
      description: 'Course description',
      instructor: { name: 'Instructor', stellarAddress: 'ADDR' },
    })),
    pagination: { total: 12, limit: 12, offset: 0 },
  };

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/courses/categories*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockCategories,
        }),
      });
    });

    await page.route('**/api/v1/courses?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCourses),
      });
    });
  });

  for (const [viewportName, viewportSize] of Object.entries(viewports)) {
    test(`filter sidebar renders correctly at ${viewportName} viewport (${viewportSize.width}x${viewportSize.height})`, async ({
      page,
    }) => {
      await page.setViewportSize(viewportSize);

      await page.goto('/courses');
      await page.waitForLoadState('networkidle');

      // On mobile, open the filter drawer if viewport is small
      if (viewportSize.width < 1024) {
        const filterButton = page.locator('button:has-text("Filters")').first();
        if (await filterButton.isVisible()) {
          await filterButton.click();
          await page.waitForTimeout(300);
        }
      }

      await page.waitForTimeout(500);

      const suffix = `${viewportName}-${viewportSize.width}x${viewportSize.height}`;
      await expect(page).toHaveScreenshot(`filter-sidebar-${suffix}.png`, {
        fullPage: false,
        animations: 'disabled',
      });
    });
  }
});
