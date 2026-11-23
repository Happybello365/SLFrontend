import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  downloadMarkdown,
  notesFilename,
  notesToMarkdown,
  printNotesAsPdf,
  type ExportableNote,
} from './notes-export';

const notes: ExportableNote[] = [
  { timestamp: 65, text: '  Second note  ', createdAt: '2026-11-23T10:00:00Z' },
  { timestamp: 5, text: '  First note  ', createdAt: '2026-11-23T09:00:00Z' },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-23T12:00:00Z'));
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('notesFilename', () => {
  it('slugifies course and lecture titles', () => {
    expect(notesFilename({ courseTitle: 'Fashion & Design!', lectureTitle: 'Lesson #1' }, 'backup', 'md'))
      .toBe('notes-fashion-design-lesson-1.md');
  });

  it('uses the fallback when titles have no usable characters', () => {
    expect(notesFilename({ courseTitle: '!!!' }, 'lecture-42', 'pdf'))
      .toBe('notes-lecture-42.pdf');
  });
});

describe('notesToMarkdown', () => {
  it('sorts notes by timestamp, trims text and includes metadata', () => {
    const markdown = notesToMarkdown(notes, { courseTitle: 'Fashion', lectureTitle: 'Introduction' });
    expect(markdown).toContain('# Notes: Introduction');
    expect(markdown).toContain('**Course:** Fashion');
    expect(markdown).toMatch(/_Exported .* · 2 notes_/);
    expect(markdown).toContain('## [0:05]\n\nFirst note');
    expect(markdown).toContain('## [1:05]\n\nSecond note');
    expect(markdown.indexOf('First note')).toBeLessThan(markdown.indexOf('Second note'));
    expect(notes[0].timestamp).toBe(65); // Does not mutate the input array.
  });

  it('handles an empty notes list and missing metadata', () => {
    const markdown = notesToMarkdown([]);
    expect(markdown).toContain('# Lecture Notes');
    expect(markdown).toMatch(/_Exported .* · 0 notes_/);
    expect(markdown).not.toContain('## [');
  });
});

describe('downloadMarkdown', () => {
  it.each([
    { markdown: '# Heading', size: 9 },
    { markdown: '', size: 0 },
  ])('downloads Markdown with size $size', async ({ markdown, size }) => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:notes-test');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadMarkdown('notes.md', markdown);

    expect(click).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/markdown;charset=utf-8');
    expect(blob.size).toBe(size);
    expect(document.querySelector('a[download="notes.md"]')).toBeNull();
    await vi.runAllTimersAsync();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:notes-test');
  });
});

describe('printNotesAsPdf', () => {
  it('writes timestamp-ordered, HTML-escaped notes into a print iframe', () => {
    printNotesAsPdf(
      [{ ...notes[0], text: '<script>alert("x")</script> & text' }, notes[1]],
      { courseTitle: 'Fashion & Design', lectureTitle: 'Cut < Sew' },
    );

    const doc = document.querySelector('iframe')?.contentDocument;
    expect(doc?.querySelector('h1')?.textContent).toBe('Notes: Cut < Sew');
    expect(doc?.querySelector('.meta')?.textContent).toContain('Fashion & Design');
    expect(Array.from(doc?.querySelectorAll('.ts') ?? [], (node) => node.textContent))
      .toEqual(['0:05', '1:05']);
    expect(doc?.body.innerHTML).toContain('&lt;script&gt;');
    expect(doc?.querySelector('script')).toBeNull();
  });

  it('generates an empty printable document when there are no notes', () => {
    printNotesAsPdf([]);
    const doc = document.querySelector('iframe')?.contentDocument;
    expect(doc?.querySelector('h1')?.textContent).toBe('Lecture Notes');
    expect(doc?.querySelector('.meta')?.textContent).toContain('0 notes');
    expect(doc?.querySelectorAll('article.note')).toHaveLength(0);
  });
});
