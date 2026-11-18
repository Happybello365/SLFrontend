import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { CurriculumAccordion } from './CurriculumAccordion';
import type { CourseModule } from '@/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MODULES: CourseModule[] = [
  {
    id: 'mod-a',
    courseId: 'c-1',
    title: 'Introduction',
    position: 1,
    lessons: [
      {
        id: 'les-1',
        moduleId: 'mod-a',
        title: 'Welcome',
        description: null,
        type: 'VIDEO',
        videoUrl: '#',
        videoDuration: 120,
        content: null,
        resourceUrl: null,
        position: 1,
        isFree: true,
      },
      {
        id: 'les-2',
        moduleId: 'mod-a',
        title: 'Setup',
        description: null,
        type: 'VIDEO',
        videoUrl: '#',
        videoDuration: 300,
        content: null,
        resourceUrl: null,
        position: 2,
        isFree: false,
      },
    ],
  },
  {
    id: 'mod-b',
    courseId: 'c-1',
    title: 'Core Concepts',
    position: 2,
    lessons: [
      {
        id: 'les-3',
        moduleId: 'mod-b',
        title: 'Basics',
        description: null,
        type: 'VIDEO',
        videoUrl: '#',
        videoDuration: 480,
        content: null,
        resourceUrl: null,
        position: 1,
        isFree: false,
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the toggle button for a given module title. */
function getToggle(name: string | RegExp) {
  return screen.getByRole('button', { name });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CurriculumAccordion – disclosure semantics', () => {
  it('renders each section header as a <button> inside an <h3>', () => {
    render(<CurriculumAccordion modules={MODULES} />);

    for (const mod of MODULES) {
      const btn = screen.getByRole('button', { name: new RegExp(mod.title) });
      expect(btn.tagName).toBe('BUTTON');
      expect(btn.closest('h3')).not.toBeNull();
    }
  });

  it('buttons carry aria-expanded reflecting open/closed state', () => {
    render(<CurriculumAccordion modules={MODULES} />);

    // First module starts expanded.
    const introBtn = getToggle(/Introduction/);
    expect(introBtn).toHaveAttribute('aria-expanded', 'true');

    // Second module starts collapsed.
    const coreBtn = getToggle(/Core Concepts/);
    expect(coreBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('aria-controls on each button points to the matching panel id', () => {
    render(<CurriculumAccordion modules={MODULES} />);

    // Check the expanded module first (panel is in the DOM).
    const introBtn = getToggle(/Introduction/);
    const panelId = introBtn.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();

    const panel = document.getElementById(panelId!);
    expect(panel).not.toBeNull();
  });

  it('visible panel carries role="region" and aria-labelledby pointing back to the button', () => {
    render(<CurriculumAccordion modules={MODULES} />);

    const introBtn = getToggle(/Introduction/);
    const panelId = introBtn.getAttribute('aria-controls')!;
    const panel = document.getElementById(panelId)!;

    expect(panel).toHaveAttribute('role', 'region');
    expect(panel).toHaveAttribute('aria-labelledby', introBtn.id);
  });

  it('toggling a closed section sets aria-expanded to true and shows the panel', async () => {
    const user = userEvent.setup();
    render(<CurriculumAccordion modules={MODULES} />);

    const coreBtn = getToggle(/Core Concepts/);
    expect(coreBtn).toHaveAttribute('aria-expanded', 'false');

    await user.click(coreBtn);

    expect(coreBtn).toHaveAttribute('aria-expanded', 'true');

    const panelId = coreBtn.getAttribute('aria-controls')!;
    const panel = document.getElementById(panelId);
    expect(panel).not.toBeNull();
    expect(within(panel!).getByText('Basics')).toBeInTheDocument();
  });

  it('toggling an open section sets aria-expanded to false and hides the panel', async () => {
    const user = userEvent.setup();
    render(<CurriculumAccordion modules={MODULES} />);

    const introBtn = getToggle(/Introduction/);
    expect(introBtn).toHaveAttribute('aria-expanded', 'true');

    const panelIdBefore = introBtn.getAttribute('aria-controls')!;
    expect(document.getElementById(panelIdBefore)).not.toBeNull();

    await user.click(introBtn);

    expect(introBtn).toHaveAttribute('aria-expanded', 'false');
    // Panel is removed from the DOM when collapsed.
    expect(document.getElementById(panelIdBefore)).toBeNull();
  });

  it('"Expand All" opens every module and sets all buttons to aria-expanded=true', async () => {
    const user = userEvent.setup();
    render(<CurriculumAccordion modules={MODULES} />);

    await user.click(screen.getByRole('button', { name: /expand all/i }));

    for (const mod of MODULES) {
      const btn = screen.getByRole('button', { name: new RegExp(mod.title) });
      expect(btn).toHaveAttribute('aria-expanded', 'true');
    }
  });

  it('"Collapse All" closes every module and sets all buttons to aria-expanded=false', async () => {
    const user = userEvent.setup();
    render(<CurriculumAccordion modules={MODULES} />);

    // Expand all first.
    await user.click(screen.getByRole('button', { name: /expand all/i }));
    // Then collapse.
    await user.click(screen.getByRole('button', { name: /collapse all/i }));

    for (const mod of MODULES) {
      const btn = screen.getByRole('button', { name: new RegExp(mod.title) });
      expect(btn).toHaveAttribute('aria-expanded', 'false');
    }
  });

  it('active lesson module auto-expands on mount', () => {
    render(<CurriculumAccordion modules={MODULES} activeLessonId="les-3" />);

    // mod-b contains les-3 and should be expanded.
    const coreBtn = getToggle(/Core Concepts/);
    expect(coreBtn).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders with placeholder data when modules prop is empty', () => {
    render(<CurriculumAccordion modules={[]} />);
    // Placeholder first module is "Getting Started".
    expect(
      screen.getByRole('button', { name: /getting started/i }),
    ).toBeInTheDocument();
  });

  it('the section heading button is keyboard-focusable (has type="button")', () => {
    render(<CurriculumAccordion modules={MODULES} />);
    const btn = getToggle(/Introduction/);
    expect(btn).toHaveAttribute('type', 'button');
  });
});
