import { test, expect, type ViewportSize } from '@playwright/test';

test.describe('LearnSidebar Visual Regression @visual', () => {
  const viewports: Record<string, ViewportSize> = {
    'extra-small': { width: 320, height: 667 },
    'small': { width: 375, height: 667 },
    'tablet': { width: 768, height: 1024 },
    'desktop': { width: 1024, height: 800 },
  };

  const mockCourseDetail = {
    id: 'course-test',
    instructorAddress: 'GABC123...',
    title: 'Test Course',
    description: 'Test course description',
    category: 'Web Development',
    level: 'Beginner',
    language: 'English',
    thumbnailUrl: null,
    previewVideoUrl: null,
    price: 49.99,
    platformFeePercent: 10,
    status: 'ACTIVE',
    totalLessons: 24,
    totalDuration: 10800,
    totalEnrollments: 342,
    totalRevenue: 17116.58,
    txHash: 'abc123',
    approvedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    instructor: {
      name: 'Test Instructor',
      stellarAddress: 'GABC123...',
      avatarUrl: null,
      bio: 'Test bio',
    },
    modules: [
      {
        id: 'mod-1',
        courseId: 'course-test',
        title: 'Module 1: Basics',
        position: 1,
        lessons: [
          {
            id: 'lesson-1',
            moduleId: 'mod-1',
            title: 'Welcome to the Course',
            description: null,
            type: 'VIDEO',
            videoUrl: null,
            videoDuration: 320,
            content: null,
            resourceUrl: null,
            position: 1,
            isFree: true,
          },
          {
            id: 'lesson-2',
            moduleId: 'mod-1',
            title: 'Getting Started Setup Instructions',
            description: null,
            type: 'VIDEO',
            videoUrl: null,
            videoDuration: 540,
            content: null,
            resourceUrl: null,
            position: 2,
            isFree: false,
          },
        ],
      },
      {
        id: 'mod-2',
        courseId: 'course-test',
        title: 'Module 2: Advanced Topics',
        position: 2,
        lessons: [
          {
            id: 'lesson-3',
            moduleId: 'mod-2',
            title: 'Deep Dive into Advanced Concepts',
            description: null,
            type: 'VIDEO',
            videoUrl: null,
            videoDuration: 720,
            content: null,
            resourceUrl: null,
            position: 1,
            isFree: false,
          },
        ],
      },
    ],
    _count: { enrollments: 342 },
    rating: 4.8,
    reviewCount: 127,
  };

  test.beforeEach(async ({ context, page }) => {
    // /dashboard/* is gated by middleware on the session cookie
    await context.addCookies([
      { name: 'sorobanlard_token', value: 'visual-test-token', url: 'http://localhost:3001' },
    ]);

    await page.route('**/api/v1/courses/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockCourseDetail,
        }),
      });
    });

    await page.route('**/api/v1/enrollments/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'enrollment-test',
            courseId: 'course-test',
            lessonProgress: [{ lessonId: 'lesson-1', completed: true }],
          },
        }),
      });
    });

    await page.route('**/api/v1/courses/categories*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { name: 'Web Development', count: 12 },
          ],
        }),
      });
    });
  });

  for (const [viewportName, viewportSize] of Object.entries(viewports)) {
    test(`sidebar renders correctly at ${viewportName} viewport (${viewportSize.width}x${viewportSize.height})`, async ({
      page,
    }) => {
      await page.setViewportSize(viewportSize);

      // The learn page lives under /dashboard, not /courses
      await page.goto('/dashboard/courses/course-test/learn');
      await page.waitForLoadState('networkidle');

      // Wait for the curriculum sidebar to render real content before snapshotting
      await page.getByText('Module 1: Basics').first().waitFor({ state: 'visible', timeout: 10000 });

      await page.waitForTimeout(1000);

      const suffix = `${viewportName}-${viewportSize.width}x${viewportSize.height}`;
      await expect(page).toHaveScreenshot(`learn-sidebar-${suffix}.png`, {
        fullPage: false,
        animations: 'disabled',
      });
    });
  }
});
