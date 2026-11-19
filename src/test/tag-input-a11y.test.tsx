import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';

// Stub the suggestions API so the component doesn't fire network calls.
vi.mock('@/lib/api/services', () => ({
  tagsApi: {
    search: vi.fn().mockResolvedValue([]),
  },
}));

import { TagInput } from '@/components/ui/TagInput';

/**
 * TagInput label association + add/remove announcements (#220).
 *
 * The acceptance criterion is "programmatically associated <label> and
 * announce added/removed tags". These tests cover both the label
 * association path (internal `label` prop AND external htmlFor) and the
 * live-region announcements fired by addTag / removeTag.
 */

function Harness({
  initial = [] as string[],
  label,
  id,
  disabled,
}: {
  initial?: string[];
  label?: string;
  id?: string;
  disabled?: boolean;
}) {
  const [tags, setTags] = useState(initial);
  return (
    <TagInput
      value={tags}
      onChange={setTags}
      label={label}
      id={id}
      disabled={disabled}
    />
  );
}

describe('TagInput label association (#220)', () => {
  it('renders a <label htmlFor={id}> when both label and id are provided', () => {
    render(<Harness label="Skills & tags" id="course-tags" />);

    const input = screen.getByRole('combobox');
    const label = screen.getByText('Skills & tags');

    expect(label.tagName.toLowerCase()).toBe('label');
    expect(label).toHaveAttribute('for', 'course-tags');
    expect(input).toHaveAttribute('id', 'course-tags');
    // getByLabelText confirms the association is accessible-name discoverable.
    expect(screen.getByLabelText(/skills & tags/i)).toBe(input);
  });

  it('does NOT render a label when only an id is provided (caller supplies label)', () => {
    // The dashboard uses <label htmlFor="course-tags"> next to <TagInput id="course-tags" />,
    // so the component must not duplicate it.
    render(
      <>
        <label htmlFor="course-tags">External label</label>
        <Harness id="course-tags" />
      </>,
    );

    const matches = screen.getAllByText('External label');
    expect(matches).toHaveLength(1);
    expect(screen.getByLabelText('External label')).toBe(screen.getByRole('combobox'));
  });

  it('always renders the input element so the htmlFor target is never orphaned', () => {
    // At max capacity the input is still in the DOM (disabled) — the external
    // <label htmlFor> must keep its target.
    render(
      <Harness
        id="course-tags"
        label="Tags"
        initial={Array.from({ length: 10 }, (_, i) => `tag-${i}`)}
      />,
    );

    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('id', 'course-tags');
    expect(input).toBeDisabled();
    // Explanatory hint is wired via aria-describedby so SR users hear it on
    // focus without a visual cue.
    expect(input).toHaveAttribute('aria-describedby', 'course-tags-maxhint');
    expect(screen.getByText(/maximum of 10 tags reached/i)).toBeInTheDocument();
  });
});

describe('TagInput add/remove announcements (#220)', () => {
  it('announces the added tag through the polite live region', () => {
    render(<Harness id="course-tags" label="Tags" />);

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Tailoring' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const live = screen.getByTestId('tag-input-sr-announcement');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveAttribute('aria-atomic', 'true');
    expect(live).toHaveTextContent(/added tag tailoring/i);
  });

  it('announces the removed tag through the polite live region', () => {
    render(<Harness id="course-tags" label="Tags" initial={['Sewing']} />);

    const remove = screen.getByRole('button', { name: /remove tag sewing/i });
    fireEvent.click(remove);

    const live = screen.getByTestId('tag-input-sr-announcement');
    expect(live).toHaveTextContent(/removed tag sewing/i);
  });

  it('does not announce when a duplicate add is rejected', () => {
    render(<Harness id="course-tags" label="Tags" initial={['Sewing']} />);

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Sewing' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const live = screen.getByTestId('tag-input-sr-announcement');
    // No added/removed message — the duplicate was silently ignored.
    expect(live.textContent?.trim() ?? '').toBe('');
  });

  it('keeps the counter live region intact (it still reports the total)', () => {
    render(<Harness id="course-tags" label="Tags" />);

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Rust' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // "1 of 10 tags added"
    expect(screen.getByText(/1 of 10 tags added/i)).toBeInTheDocument();
  });
});
