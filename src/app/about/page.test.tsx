import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AboutPage, { metadata } from './page';

// The About route is static: it does not fetch data or expose a loading state.
// Mock presentational children, not the page sections or navigation CTAs.
const team = vi.hoisted(() => ({ throwOnRender: false }));

vi.mock('@/components/layout/TopBar', () => ({
  TopBar: () => <header data-testid="site-header">SorobanLard</header>,
}));
vi.mock('@/components/about/AnimatedCounter', () => ({
  AnimatedCounter: ({ value, suffix = '' }: { value: number; suffix?: string }) => (
    <span>{value}{suffix}</span>
  ),
}));
vi.mock('@/components/about/TeamGrid', () => ({
  TeamGrid: ({ members }: { members: Array<{ id: string; name: string }> }) => {
    if (team.throwOnRender) throw new Error('Team component unavailable');
    return (
      <ul aria-label="Team members">
        {members.map((member) => <li key={member.id}>{member.name}</li>)}
      </ul>
    );
  },
}));

beforeEach(() => { team.throwOnRender = false; });
afterEach(() => { vi.restoreAllMocks(); });

describe('AboutPage (#407)', () => {
  it('provides SEO metadata and renders the main page sections', () => {
    render(<AboutPage />);

    expect(metadata).toMatchObject({
      alternates: { canonical: expect.stringContaining('/about') },
    });
    expect(screen.getByTestId('site-header')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Empowering Africa with practical skills' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Founded in 2022' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Built on principles that matter' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Talented people on a mission' })).toBeInTheDocument();
  });

  it('renders six team members, platform statistics and values', () => {
    render(<AboutPage />);

    expect(screen.getByRole('list', { name: 'Team members' }).children).toHaveLength(6);
    expect(screen.getByText('Ava Chen')).toBeInTheDocument();
    expect(screen.getByText('Active Learners')).toBeInTheDocument();
    expect(screen.getByText('Quality Courses')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Accessibility' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Transparency' })).toBeInTheDocument();
  });

  it('shows the correct signup and instructor application CTAs', () => {
    render(<AboutPage />);

    expect(screen.getByRole('heading', { name: 'Ready to join us?' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Join as a student' })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: 'Become an instructor' })).toHaveAttribute('href', '/instructor-apply');
  });

  it('propagates a child render failure to the route error boundary', () => {
    // This static page has no data-loading error branch. It must not hide a
    // component render failure; Next.js handles it at the route boundary.
    team.throwOnRender = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<AboutPage />)).toThrow('Team component unavailable');
  });
});
