import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';

// Drive the countdown deterministically from the test without wall-clock
// timers — each test sets what useCountdown should return.
const countdownState = {
  secondsLeft: 0,
  isWarning: false,
  isActive: false,
  isExpired: false,
  restart: vi.fn(),
};

vi.mock('@/lib/hooks/use-countdown', () => ({
  useCountdown: () => countdownState,
  COUNTDOWN_WARNING_SECONDS: 30,
}));

import { QuizComponent } from '@/components/learn/QuizComponent';
import type { QuizQuestion } from '@/types';

/**
 * QuizComponent timed-question announcements (#218).
 *
 * The timer and question transitions must reach screen-reader users via
 * an aria-live region. These tests exercise the live-region content
 * driven by `useCountdown`, which is mocked so tests don't race the
 * wall clock.
 */

const QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    type: 'single_select',
    question: 'What is 1 + 1?',
    options: [
      { id: 'a', text: '2', isCorrect: true },
      { id: 'b', text: '3', isCorrect: false },
    ],
  },
  {
    id: 'q2',
    type: 'single_select',
    question: 'What is 2 + 2?',
    options: [
      { id: 'a', text: '4', isCorrect: true },
      { id: 'b', text: '5', isCorrect: false },
    ],
  },
] as unknown as QuizQuestion[];

function resetCountdown(overrides: Partial<typeof countdownState> = {}) {
  countdownState.secondsLeft = 0;
  countdownState.isWarning = false;
  countdownState.isActive = false;
  countdownState.isExpired = false;
  countdownState.restart = vi.fn();
  Object.assign(countdownState, overrides);
}

function getLiveRegion() {
  return screen.getByTestId('quiz-sr-announcement');
}

describe('QuizComponent SR announcements (#218)', () => {
  it('renders a polite aria-live region for announcements', () => {
    resetCountdown();
    render(<QuizComponent questions={QUESTIONS} />);
    const live = getLiveRegion();
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveAttribute('aria-atomic', 'true');
    expect(live).toHaveAttribute('role', 'status');
  });

  it('announces the current question on mount and after transition', () => {
    resetCountdown();
    render(<QuizComponent questions={QUESTIONS} />);

    // Initial render: "Question 1 of 2"
    expect(getLiveRegion()).toHaveTextContent(/question 1 of 2/i);

    // Answer + submit + go next
    fireEvent.click(screen.getByLabelText('2'));
    fireEvent.click(screen.getByRole('button', { name: /submit answer/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(getLiveRegion()).toHaveTextContent(/question 2 of 2/i);
  });

  it('announces a timer warning exactly once when crossing into the low-time window', () => {
    // Start out of warning; useCountdown says we have a timer but plenty of time.
    resetCountdown({ secondsLeft: 45, isWarning: false, isActive: true });
    const { rerender } = render(
      <QuizComponent questions={QUESTIONS} timeLimitSeconds={45} />,
    );
    expect(getLiveRegion().textContent).not.toMatch(/time is running low/i);

    // Cross into the warning band.
    countdownState.secondsLeft = 25;
    countdownState.isWarning = true;
    rerender(<QuizComponent questions={QUESTIONS} timeLimitSeconds={45} />);

    expect(getLiveRegion().textContent).toMatch(/time is running low/i);

    // Further warning ticks must NOT refire the announcement — snapshot it.
    const after = getLiveRegion().textContent;
    countdownState.secondsLeft = 18;
    rerender(<QuizComponent questions={QUESTIONS} timeLimitSeconds={45} />);
    expect(getLiveRegion().textContent).toBe(after);
  });

  it('does not announce a warning when the quiz is untimed', () => {
    resetCountdown();
    render(<QuizComponent questions={QUESTIONS} />);

    expect(getLiveRegion().textContent).not.toMatch(/time is running low/i);
    expect(getLiveRegion()).toHaveTextContent(/question 1 of 2/i);
  });
});
