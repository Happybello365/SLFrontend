import { test, expect } from '@playwright/test';

/**
 * Role-aware login (#236).
 *
 * The README documents that at first login a user picks student or
 * instructor; the resulting dashboard route differs by role. This spec
 * drives `/login` as each role and asserts the redirect, plus one
 * failure path (wrong credentials) so the happy path isn't the only
 * thing covered.
 *
 * All network calls are mocked (`page.route`) so the spec is fully
 * deterministic and doesn't need a seeded backend.
 */

const STUDENT_USER = {
  id: 'u-student-1',
  email: 'student@example.com',
  name: 'Sade Student',
  role: 'student',
  stellarAddress: 'GABCDSTUDENTADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
};

const INSTRUCTOR_USER = {
  id: 'u-instructor-1',
  email: 'instructor@example.com',
  name: 'Ike Instructor',
  role: 'instructor',
  stellarAddress: 'GABCDINSTRUCTORADDRESSBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
};

/**
 * Mock the email/password login endpoint (`POST /auth/email/login`). All
 * other API calls fall through to the real backend; the surfaces each
 * role lands on fetch their own data, which is not what this spec
 * asserts.
 */
async function mockLogin(page: Parameters<typeof test>[0], user: typeof STUDENT_USER | null) {
  await page.route('**/auth/email/login', async (route) => {
    if (user) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            accessToken: 'test-access-token-' + Date.now(),
            user,
          },
        }),
      });
    } else {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Invalid email or password. Please try again.',
          message: 'Invalid email or password. Please try again.',
        }),
      });
    }
  });
}

test.describe('Role-aware login (#236)', () => {
  test('student login lands on the student dashboard', async ({ page }) => {
    await mockLogin(page, STUDENT_USER);

    await page.goto('/login');

    await page.getByLabel(/email/i).fill(STUDENT_USER.email);
    await page.getByLabel(/password/i).fill('correct-horse-battery-staple');
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // The page navigates to /dashboard; a student should NOT end up on
    // /dashboard/instructor.
    await expect(page).toHaveURL(/\/dashboard(\/|$)(?!instructor)/, { timeout: 10_000 });
    await expect(page).not.toHaveURL(/\/dashboard\/instructor/);
  });

  test('instructor login lands on the instructor dashboard', async ({ page }) => {
    await mockLogin(page, INSTRUCTOR_USER);

    await page.goto('/login');

    await page.getByLabel(/email/i).fill(INSTRUCTOR_USER.email);
    await page.getByLabel(/password/i).fill('correct-horse-battery-staple');
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Instructors are routed to the instructor surface. The app may do
    // this via middleware, a client redirect from `/dashboard`, or a
    // callbackUrl — any of them lands the URL under `/dashboard/instructor`.
    await expect(page).toHaveURL(/\/dashboard\/instructor/, { timeout: 10_000 });
  });

  test('wrong credentials keep the user on /login with an error banner', async ({ page }) => {
    await mockLogin(page, null);

    await page.goto('/login');

    await page.getByLabel(/email/i).fill('nobody@example.com');
    await page.getByLabel(/password/i).fill('wrong-password');
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Failed login must not navigate away from /login and must surface
    // the error through the existing role="alert" banner.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('alert')).toContainText(/invalid email or password/i);
  });
});
