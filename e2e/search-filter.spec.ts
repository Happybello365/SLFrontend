/**
 * e2e/search-filter.spec.ts
 *
 * End-to-end coverage for the Search and filter course marketplace:
 *   SearchBar  (src/components/search/SearchBar.tsx)
 *   FilterPanel (src/components/search/FilterPanel.tsx)
 *   FilterDrawer (src/components/search/FilterDrawer.tsx)
 *   ActiveFilterChips (src/components/search/ActiveFilterChips.tsx)
 *   EmptyResults (src/components/search/EmptyResults.tsx)
 *   Search page (src/app/search/page.tsx)
 *
 * ── Data contract ──────────────────────────────────────────────────────────
 * The search page renders a fixed MOCK_COURSES array entirely client-side;
 * no backend API calls are made.  All test expectations are derived from
 * those five courses:
 *
 *  id | title                                    | category       | level        | price (¢)
 *  1  | Professional Tailoring Masterclass       | Tailoring      | Intermediate | 4999
 *  2  | Artisan Baking: From Basics to Pastries  | Baking         | Beginner     | 3499
 *  3  | Professional Photography: Capturing Light| Photography    | Intermediate | 5999
 *  4  | Makeup Artistry: Bridal & Event Makeup   | Makeup Artistry| Intermediate | 4499
 *  5  | Modern Hairstyling & Hair Care           | Hairstyling    | Beginner     | 3999
 *
 *  All five durations (960–1800 min) fall in the "long" bucket (> 600 min).
 *
 * ── Loading delay ──────────────────────────────────────────────────────────
 * The page sets isLoading=true whenever filters change, then clears it after
 * a 450 ms setTimeout.  Every test waits for the results count text to become
 * visible before asserting on course cards (this proves isLoading=false).
 *
 * ── Zustand store state isolation ──────────────────────────────────────────
 * useSearchStore persists only recentSearches and savedSearches in localStorage
 * under the key "search-store".  Filter state (categories, levels, etc.) is
 * not persisted and always starts empty.  Each test clears "search-store" via
 * addInitScript to prevent cross-test bleed from recent/saved searches.
 */

import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wipe the Zustand persist storage before the page boots. */
async function clearSearchStore(page: Page) {
  await page.addInitScript(() => {
    localStorage.removeItem('search-store');
  });
}

/**
 * Navigate to the search page and wait until the loading skeleton is gone and
 * the results count text has appeared.  Returns once the page is interactive.
 */
async function gotoSearch(page: Page, params = '') {
  await page.goto(`/search${params}`);
  // The page always starts with isLoading=true for 450 ms; wait for real content.
  await expect(
    page.getByText(/\d+ courses? found/i),
  ).toBeVisible({ timeout: 5000 });
}

/** Tick the checkbox for a named filter label inside a filter group. */
async function checkFilter(page: Page, label: string) {
  await page.getByLabel(label, { exact: false }).check();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Search page', () => {
  test.beforeEach(async ({ page }) => {
    await clearSearchStore(page);
  });

  // ── 1. Page load defaults ──────────────────────────────────────────────────

  test.describe('initial load', () => {
    test('renders heading and all 5 courses before any interaction', async ({ page }) => {
      await gotoSearch(page);

      await expect(page.getByRole('heading', { name: /search courses/i })).toBeVisible();
      await expect(page.getByText('5 courses found')).toBeVisible();

      // All five course titles should appear as h3 elements inside cards.
      const titles = [
        'Professional Tailoring Masterclass',
        'Artisan Baking: From Basics to Pastries',
        'Professional Photography: Capturing Light',
        'Makeup Artistry: Bridal & Event Makeup',
        'Modern Hairstyling & Hair Care',
      ];
      for (const title of titles) {
        await expect(page.getByRole('heading', { name: title, level: 3 })).toBeVisible();
      }
    });

    test('shows no active filter chips on first load', async ({ page }) => {
      await gotoSearch(page);
      // The ActiveFilterChips component returns null when chips.length === 0.
      await expect(page.getByText(/^Active:/)).not.toBeVisible();
    });

    test('shows loading skeleton before 450 ms then replaces it with real content', async ({
      page,
    }) => {
      // Navigate but do NOT wait for content — catch the in-flight state.
      await page.goto('/search');

      // Within the first 450 ms the results-count skeleton should be present.
      await expect(page.getByTestId('results-count-skeleton')).toBeVisible({ timeout: 400 });

      // After the timeout the skeleton must be gone and the count must appear.
      await expect(page.getByText(/\d+ courses? found/i)).toBeVisible({ timeout: 3000 });
      await expect(page.getByTestId('results-count-skeleton')).not.toBeVisible();
    });
  });

  // ── 2. URL-based initialisation ────────────────────────────────────────────

  test.describe('URL query params', () => {
    test('?q= pre-fills the search box and filters results', async ({ page }) => {
      await gotoSearch(page, '?q=baking');

      // SearchBar should show the query value.
      await expect(
        page.getByRole('combobox', { name: /search/i }),
      ).toHaveValue('baking');

      // Only the Baking course matches.
      await expect(page.getByText('1 course found')).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /artisan baking/i, level: 3 }),
      ).toBeVisible();
    });

    test('?category= pre-selects the category filter and narrows results', async ({ page }) => {
      await gotoSearch(page, '?category=Photography');

      // The Photography checkbox should be checked.
      await expect(
        page.getByLabel('Photography', { exact: false }),
      ).toBeChecked();

      // Only the Photography course passes the filter.
      await expect(page.getByText('1 course found')).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /professional photography/i, level: 3 }),
      ).toBeVisible();
    });
  });

  // ── 3. SearchBar ───────────────────────────────────────────────────────────

  test.describe('SearchBar', () => {
    test('typing into the search box narrows results and updates the count', async ({ page }) => {
      await gotoSearch(page);

      const input = page.getByRole('combobox');
      await input.fill('tailoring');

      // After the 450 ms loading cycle the page should show one result.
      await expect(page.getByText('1 course found')).toBeVisible({ timeout: 3000 });
      await expect(
        page.getByRole('heading', { name: /professional tailoring/i, level: 3 }),
      ).toBeVisible();
    });

    test('shows inline autocomplete suggestions while typing', async ({ page }) => {
      await gotoSearch(page);

      const input = page.getByRole('combobox');
      await input.fill('photo');

      // The suggestions dropdown should appear.
      await expect(
        page.getByRole('listbox').or(page.locator('#search-suggestions')),
      ).toBeVisible({ timeout: 2000 });

      // At minimum the Photography category or the Photography course should appear.
      await expect(
        page.getByRole('option', { name: /photography/i }).first(),
      ).toBeVisible();
    });

    test('selecting a category suggestion navigates to ?category= URL', async ({ page }) => {
      await gotoSearch(page);

      const input = page.getByRole('combobox');
      await input.fill('Baking');

      const suggestion = page
        .getByRole('option', { name: /^baking$/i })
        .or(page.getByRole('option').filter({ hasText: /^baking$/i }));

      await expect(suggestion.first()).toBeVisible({ timeout: 2000 });
      await suggestion.first().click();

      await page.waitForURL(/\/search/);
      // After navigation the Baking course should be in the results.
      await expect(page.getByText(/1 course found/i)).toBeVisible({ timeout: 5000 });
    });

    test('submitting form navigates to /search?q=', async ({ page }) => {
      await gotoSearch(page);

      const input = page.getByRole('combobox');
      await input.fill('makeup');
      await input.press('Enter');

      await page.waitForURL(/\/search\?q=makeup/i);
      await expect(page.getByText('1 course found')).toBeVisible({ timeout: 5000 });
    });

    test('clear button resets the query and shows all courses', async ({ page }) => {
      await gotoSearch(page, '?q=baking');
      await expect(page.getByText('1 course found')).toBeVisible();

      // Click the ✕ clear button inside the search bar.
      await page.getByRole('button', { name: /clear search/i }).click();

      await expect(page.getByRole('combobox')).toHaveValue('');
      await expect(page.getByText('5 courses found')).toBeVisible({ timeout: 3000 });
    });

    test('trending categories are shown when input is focused but empty', async ({ page }) => {
      await gotoSearch(page);

      // Focus the empty search input.
      await page.getByRole('combobox').click();

      // The trending section should appear in the dropdown.
      await expect(page.getByText(/trending/i)).toBeVisible({ timeout: 2000 });
    });

    test('recent searches appear after performing a search', async ({ page }) => {
      // Seed a recent search via localStorage before the page loads.
      await page.addInitScript(() => {
        const snapshot = {
          recentSearches: [
            {
              query: 'photography',
              sortBy: 'relevance',
              selectedCategories: [],
              selectedLevels: [],
              selectedDurations: [],
              priceRange: { min: 0, max: null },
              minRating: 0,
              timestamp: Date.now(),
            },
          ],
          savedSearches: [],
        };
        localStorage.setItem('search-store', JSON.stringify({ state: snapshot, version: 0 }));
      });

      await gotoSearch(page);

      // Focus the empty input to open the trending/recent dropdown.
      await page.getByRole('combobox').click();

      await expect(page.getByText(/recent/i)).toBeVisible({ timeout: 2000 });
      await expect(page.getByRole('button', { name: /photography/i })).toBeVisible();
    });
  });

  // ── 4. FilterPanel (desktop sidebar) ──────────────────────────────────────

  test.describe('FilterPanel – category filter', () => {
    test('selecting one category shows only courses in that category', async ({ page }) => {
      await gotoSearch(page);

      // On desktop the filter panel is visible in the sidebar.
      await checkFilter(page, 'Hairstyling');

      await expect(page.getByText('1 course found')).toBeVisible({ timeout: 3000 });
      await expect(
        page.getByRole('heading', { name: /modern hairstyling/i, level: 3 }),
      ).toBeVisible();

      // Other courses must not appear.
      await expect(
        page.getByRole('heading', { name: /artisan baking/i, level: 3 }),
      ).not.toBeVisible();
    });

    test('selecting multiple categories returns the union of results', async ({ page }) => {
      await gotoSearch(page);

      await checkFilter(page, 'Baking');
      await checkFilter(page, 'Hairstyling');

      await expect(page.getByText('2 courses found')).toBeVisible({ timeout: 3000 });
      await expect(
        page.getByRole('heading', { name: /artisan baking/i, level: 3 }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /modern hairstyling/i, level: 3 }),
      ).toBeVisible();
    });

    test('unchecking a category restores the full result set', async ({ page }) => {
      await gotoSearch(page);

      const checkbox = page.getByLabel('Tailoring', { exact: false });
      await checkbox.check();
      await expect(page.getByText('1 course found')).toBeVisible({ timeout: 3000 });

      await checkbox.uncheck();
      await expect(page.getByText('5 courses found')).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('FilterPanel – level filter', () => {
    test('Beginner level shows only beginner courses', async ({ page }) => {
      await gotoSearch(page);

      await checkFilter(page, 'Beginner');

      // 2 beginner courses: Baking and Hairstyling.
      await expect(page.getByText('2 courses found')).toBeVisible({ timeout: 3000 });
      await expect(
        page.getByRole('heading', { name: /artisan baking/i, level: 3 }),
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /modern hairstyling/i, level: 3 }),
      ).toBeVisible();
    });

    test('Intermediate level shows only intermediate courses', async ({ page }) => {
      await gotoSearch(page);

      await checkFilter(page, 'Intermediate');

      // 3 intermediate courses: Tailoring, Photography, Makeup Artistry.
      await expect(page.getByText('3 courses found')).toBeVisible({ timeout: 3000 });
    });

    test('combining category and level filters applies AND logic', async ({ page }) => {
      await gotoSearch(page);

      // Beginner + Baking: only Artisan Baking qualifies.
      await checkFilter(page, 'Beginner');
      await checkFilter(page, 'Baking');

      await expect(page.getByText('1 course found')).toBeVisible({ timeout: 3000 });
      await expect(
        page.getByRole('heading', { name: /artisan baking/i, level: 3 }),
      ).toBeVisible();
    });
  });

  test.describe('FilterPanel – sort order', () => {
    test('sorting by "Price: Low to High" shows cheapest course first', async ({ page }) => {
      await gotoSearch(page);

      await page.getByLabel('Sort results').selectOption('price-low');

      // After re-render the cheapest course (Baking, ¢3499) should be first.
      await expect(page.getByText('5 courses found')).toBeVisible({ timeout: 3000 });

      const cards = page.getByRole('heading', { level: 3 });
      await expect(cards.first()).toContainText(/artisan baking/i);
    });

    test('sorting by "Price: High to Low" shows most expensive course first', async ({ page }) => {
      await gotoSearch(page);

      await page.getByLabel('Sort results').selectOption('price-high');

      await expect(page.getByText('5 courses found')).toBeVisible({ timeout: 3000 });

      const cards = page.getByRole('heading', { level: 3 });
      await expect(cards.first()).toContainText(/professional photography/i);
    });

    test('sorting by "Highest Rated" puts best-rated course first', async ({ page }) => {
      await gotoSearch(page);

      await page.getByLabel('Sort results').selectOption('rating');

      await expect(page.getByText('5 courses found')).toBeVisible({ timeout: 3000 });

      // Highest rated is Baking/Makeup Artistry (both 4.9). Either is acceptable first.
      const firstCard = page.getByRole('heading', { level: 3 }).first();
      const firstTitle = await firstCard.textContent();
      expect(firstTitle).toMatch(/artisan baking|makeup artistry/i);
    });
  });

  test.describe('FilterPanel – price presets', () => {
    test('"Under ₦40" preset filters to courses below ¢4000', async ({ page }) => {
      await gotoSearch(page);

      // Click the "Under ₦40" radio (price < 4000 cents).
      await page.getByLabel('Under ₦40').click();

      // Only Baking (¢3499) and Hairstyling (¢3999) qualify.
      await expect(page.getByText('2 courses found')).toBeVisible({ timeout: 3000 });
    });

    test('"Over ₦50" preset filters to courses above ¢5000', async ({ page }) => {
      await gotoSearch(page);

      await page.getByLabel('Over ₦50').click();

      // Only Photography (¢5999) qualifies.
      await expect(page.getByText('1 course found')).toBeVisible({ timeout: 3000 });
      await expect(
        page.getByRole('heading', { name: /professional photography/i, level: 3 }),
      ).toBeVisible();
    });
  });

  test.describe('FilterPanel – minimum rating', () => {
    test('"4.5 & up" rating filter shows only courses rated ≥ 4.5', async ({ page }) => {
      await gotoSearch(page);

      await page.getByLabel('4.5 & up').click();

      // Courses with rating ≥ 4.5: Tailoring(4.8), Baking(4.9), Photography(4.7),
      // Makeup Artistry(4.9), Hairstyling(4.8) → all 5.
      await expect(page.getByText('5 courses found')).toBeVisible({ timeout: 3000 });
    });
  });

  // ── 5. ActiveFilterChips ───────────────────────────────────────────────────

  test.describe('ActiveFilterChips', () => {
    test('selecting a category creates a chip labelled with that category', async ({ page }) => {
      await gotoSearch(page);

      await checkFilter(page, 'Photography');

      await expect(page.getByText(/^Active:/)).toBeVisible({ timeout: 3000 });
      // The chip button contains the category name.
      await expect(
        page.getByRole('button', { name: /photography/i }).filter({ hasText: /photography/i }),
      ).toBeVisible();
    });

    test('clicking a chip removes that filter and updates the count', async ({ page }) => {
      await gotoSearch(page);

      await checkFilter(page, 'Photography');
      await expect(page.getByText('1 course found')).toBeVisible({ timeout: 3000 });

      // Click the Photography chip to remove it.
      const chip = page
        .getByRole('button')
        .filter({ hasText: /photography/i })
        .first();
      await chip.click();

      await expect(page.getByText('5 courses found')).toBeVisible({ timeout: 3000 });
      await expect(page.getByText(/^Active:/)).not.toBeVisible();
    });

    test('"Clear all" button removes all chips and restores full results', async ({ page }) => {
      await gotoSearch(page);

      await checkFilter(page, 'Tailoring');
      await checkFilter(page, 'Beginner');

      // Two active chips: category + level.
      await expect(page.getByText(/^Active:/)).toBeVisible({ timeout: 3000 });

      await page.getByRole('button', { name: /clear all/i }).first().click();

      await expect(page.getByText('5 courses found')).toBeVisible({ timeout: 3000 });
      await expect(page.getByText(/^Active:/)).not.toBeVisible();
    });

    test('a query chip appears when text is entered, and removing it resets results', async ({
      page,
    }) => {
      await gotoSearch(page, '?q=baking');

      // A chip for the search term "baking" should be visible.
      await expect(
        page.getByRole('button').filter({ hasText: /"baking"/i }),
      ).toBeVisible({ timeout: 3000 });

      // Click the chip to remove the query.
      await page
        .getByRole('button')
        .filter({ hasText: /"baking"/i })
        .click();

      await expect(page.getByText('5 courses found')).toBeVisible({ timeout: 3000 });
    });
  });

  // ── 6. EmptyResults ────────────────────────────────────────────────────────

  test.describe('EmptyResults', () => {
    test('a query matching no course title shows the empty-state heading', async ({ page }) => {
      await gotoSearch(page, '?q=xyznonexistent');

      await expect(
        page.getByRole('heading', { name: /no courses found/i }),
      ).toBeVisible({ timeout: 5000 });

      await expect(
        page.getByText(/couldn't find anything matching "xyznonexistent"/i),
      ).toBeVisible();
    });

    test('"Did you mean…" suggestion appears for a near-miss query', async ({ page }) => {
      // "Tailring" is one edit away from "Tailoring" and within threshold.
      await gotoSearch(page, '?q=Tailring');

      await expect(
        page.getByRole('heading', { name: /no courses found/i }),
      ).toBeVisible({ timeout: 5000 });

      await expect(page.getByText(/did you mean/i)).toBeVisible();
      // The suggestion button should contain "Tailoring".
      await expect(
        page.getByRole('button', { name: /tailoring/i }),
      ).toBeVisible();
    });

    test('clicking "Did you mean" suggestion updates results', async ({ page }) => {
      await gotoSearch(page, '?q=Tailring');

      await expect(page.getByRole('heading', { name: /no courses found/i })).toBeVisible({
        timeout: 5000,
      });

      await page.getByRole('button', { name: /tailoring/i }).click();

      // After adopting the correction, the Tailoring course should appear.
      await expect(
        page.getByRole('heading', { name: /professional tailoring/i, level: 3 }),
      ).toBeVisible({ timeout: 5000 });
    });

    test('popular-category links appear in the empty state', async ({ page }) => {
      await gotoSearch(page, '?q=xyznonexistent');

      await expect(
        page.getByRole('heading', { name: /no courses found/i }),
      ).toBeVisible({ timeout: 5000 });

      // The suggestedCategories links should render.
      await expect(
        page.getByRole('link', { name: /tailoring/i }),
      ).toBeVisible();
    });

    test('"Clear all filters" in empty state resets to full results', async ({ page }) => {
      await gotoSearch(page);

      // Filter to a category, then search for a term that returns nothing within it.
      await checkFilter(page, 'Baking');
      await expect(page.getByText('1 course found')).toBeVisible({ timeout: 3000 });

      const input = page.getByRole('combobox');
      await input.fill('photography');

      await expect(
        page.getByRole('heading', { name: /no courses found/i }),
      ).toBeVisible({ timeout: 5000 });

      await page.getByRole('button', { name: /clear all filters/i }).click();

      await expect(page.getByText('5 courses found')).toBeVisible({ timeout: 5000 });
    });
  });

  // ── 7. Combined search + filter ────────────────────────────────────────────

  test.describe('combined search and filter', () => {
    test('query + level filter intersect correctly', async ({ page }) => {
      await gotoSearch(page);

      // Type a broad query that matches multiple courses.
      const input = page.getByRole('combobox');
      await input.fill('professional');

      await expect(page.getByText(/2 courses? found/i)).toBeVisible({ timeout: 3000 });

      // Now restrict to Intermediate only — both "Professional…" courses are Intermediate.
      await checkFilter(page, 'Intermediate');

      await expect(page.getByText('2 courses found')).toBeVisible({ timeout: 3000 });
    });

    test('query + category filter narrows to a single course', async ({ page }) => {
      await gotoSearch(page, '?category=Baking');

      await expect(page.getByText('1 course found')).toBeVisible({ timeout: 3000 });

      // Further narrow by typing a matching term.
      const input = page.getByRole('combobox');
      await input.fill('artisan');

      await expect(page.getByText('1 course found')).toBeVisible({ timeout: 3000 });
      await expect(
        page.getByRole('heading', { name: /artisan baking/i, level: 3 }),
      ).toBeVisible();
    });

    test('query + category filter with no overlap yields empty results', async ({ page }) => {
      await gotoSearch(page);

      // Type a term that only matches Photography.
      const input = page.getByRole('combobox');
      await input.fill('photography');

      await expect(page.getByText('1 course found')).toBeVisible({ timeout: 3000 });

      // Restrict to Baking category — intersection is empty.
      await checkFilter(page, 'Baking');

      await expect(
        page.getByRole('heading', { name: /no courses found/i }),
      ).toBeVisible({ timeout: 5000 });
    });
  });

  // ── 8. FilterDrawer (mobile viewport) ─────────────────────────────────────

  test.describe('FilterDrawer on mobile', () => {
    // Use a viewport where the desktop sidebar is hidden and the drawer button appears.
    test.use({ viewport: { width: 390, height: 844 } });

    test('drawer opens when "Show Filters" is clicked', async ({ page }) => {
      await gotoSearch(page);

      await page.getByRole('button', { name: /show filters/i }).click();

      await expect(
        page.getByRole('dialog', { name: /filter courses/i }),
      ).toBeVisible({ timeout: 2000 });
    });

    test('drawer closes when "Close filters" is clicked', async ({ page }) => {
      await gotoSearch(page);

      await page.getByRole('button', { name: /show filters/i }).click();
      await expect(page.getByRole('dialog', { name: /filter courses/i })).toBeVisible();

      await page.getByRole('button', { name: /close filters/i }).click();

      await expect(
        page.getByRole('dialog', { name: /filter courses/i }),
      ).not.toBeVisible({ timeout: 2000 });
    });

    test('drawer closes when Escape is pressed', async ({ page }) => {
      await gotoSearch(page);

      await page.getByRole('button', { name: /show filters/i }).click();
      await expect(page.getByRole('dialog', { name: /filter courses/i })).toBeVisible();

      await page.keyboard.press('Escape');

      await expect(
        page.getByRole('dialog', { name: /filter courses/i }),
      ).not.toBeVisible({ timeout: 2000 });
    });

    test('selecting a filter inside the drawer narrows results after closing', async ({ page }) => {
      await gotoSearch(page);

      await page.getByRole('button', { name: /show filters/i }).click();

      const drawer = page.getByRole('dialog', { name: /filter courses/i });
      await expect(drawer).toBeVisible();

      // Tick Photography inside the drawer.
      await drawer.getByLabel('Photography', { exact: false }).check();

      // Click the "Show N results" apply button.
      await drawer.getByRole('button', { name: /show.*result/i }).click();

      await expect(
        page.getByRole('dialog', { name: /filter courses/i }),
      ).not.toBeVisible({ timeout: 2000 });

      await expect(page.getByText('1 course found')).toBeVisible({ timeout: 3000 });
    });

    test('filter badge count on the button reflects the number of active filters', async ({
      page,
    }) => {
      await gotoSearch(page);

      await page.getByRole('button', { name: /show filters/i }).click();
      const drawer = page.getByRole('dialog', { name: /filter courses/i });

      await drawer.getByLabel('Photography', { exact: false }).check();
      await drawer.getByLabel('Intermediate', { exact: false }).check();
      await drawer.getByRole('button', { name: /show.*result/i }).click();

      // The "Show Filters" button should now show a badge of 2.
      await expect(
        page.getByRole('button', { name: /show filters/i }).getByText('2'),
      ).toBeVisible({ timeout: 2000 });
    });

    test('"Clear all" inside the drawer resets filters and shows all courses', async ({ page }) => {
      await gotoSearch(page);

      await page.getByRole('button', { name: /show filters/i }).click();
      const drawer = page.getByRole('dialog', { name: /filter courses/i });

      await drawer.getByLabel('Baking', { exact: false }).check();
      await drawer.getByRole('button', { name: /show.*result/i }).click();

      await expect(page.getByText('1 course found')).toBeVisible({ timeout: 3000 });

      // Re-open and clear.
      await page.getByRole('button', { name: /show filters/i }).click();
      await page.getByRole('dialog', { name: /filter courses/i })
        .getByRole('button', { name: /clear all/i })
        .click();

      // The drawer apply button should now report 5 results.
      await expect(
        page.getByRole('dialog', { name: /filter courses/i })
          .getByRole('button', { name: /show 5 results/i }),
      ).toBeVisible({ timeout: 3000 });
    });
  });

  // ── 9. Edge cases ──────────────────────────────────────────────────────────

  test.describe('edge cases', () => {
    test('searching instructor name returns that instructor\'s courses', async ({ page }) => {
      await gotoSearch(page);

      const input = page.getByRole('combobox');
      await input.fill('Amara Okafor');

      // Amara Okafor is the instructor for the Tailoring course.
      await expect(page.getByText('1 course found')).toBeVisible({ timeout: 3000 });
      await expect(
        page.getByRole('heading', { name: /professional tailoring/i, level: 3 }),
      ).toBeVisible();
    });

    test('search is case-insensitive', async ({ page }) => {
      await gotoSearch(page);

      const input = page.getByRole('combobox');
      await input.fill('BAKING');

      await expect(page.getByText('1 course found')).toBeVisible({ timeout: 3000 });
    });

    test('a query matching course description returns that course', async ({ page }) => {
      await gotoSearch(page);

      // "composition" appears only in the Photography course description.
      const input = page.getByRole('combobox');
      await input.fill('composition');

      await expect(page.getByText('1 course found')).toBeVisible({ timeout: 3000 });
      await expect(
        page.getByRole('heading', { name: /professional photography/i, level: 3 }),
      ).toBeVisible();
    });

    test('selecting all five categories shows all courses', async ({ page }) => {
      await gotoSearch(page);

      const categories = ['Tailoring', 'Baking', 'Photography', 'Makeup Artistry', 'Hairstyling'];
      for (const cat of categories) {
        await checkFilter(page, cat);
      }

      await expect(page.getByText('5 courses found')).toBeVisible({ timeout: 3000 });
    });

    test('page does not break when both Beginner and Intermediate levels are selected', async ({
      page,
    }) => {
      await gotoSearch(page);

      await checkFilter(page, 'Beginner');
      await checkFilter(page, 'Intermediate');

      // All 5 courses are either Beginner or Intermediate.
      await expect(page.getByText('5 courses found')).toBeVisible({ timeout: 3000 });
    });
  });
});
