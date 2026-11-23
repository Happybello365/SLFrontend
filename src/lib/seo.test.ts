import { describe, expect, it } from 'vitest';
import {
  absoluteUrl,
  buildMetadata,
  buildPaginatedMetadata,
  DISALLOWED_PATHS,
  PUBLIC_ROUTES,
  siteConfig,
  siteUrl,
} from './seo';

describe('SEO configuration', () => {
  it('exposes a consistent site URL and public/non-public routes', () => {
    expect(siteConfig.url).toBe(siteUrl);
    expect(siteUrl).not.toMatch(/\/$/);
    expect(DISALLOWED_PATHS).toContain('/dashboard');
    expect(PUBLIC_ROUTES.map(({ path }) => path)).toContain('/');
    expect(PUBLIC_ROUTES.some(({ path }) => DISALLOWED_PATHS.includes(path))).toBe(false);
  });
});

describe('absoluteUrl', () => {
  it('prefixes relative paths with the site origin', () => {
    expect(absoluteUrl('/courses')).toBe(`${siteUrl}/courses`);
    expect(absoluteUrl('courses')).toBe(`${siteUrl}/courses`);
  });

  it('handles an empty path as the homepage', () => {
    expect(absoluteUrl('')).toBe(`${siteUrl}/`);
  });
});

describe('buildMetadata', () => {
  it('creates canonical, Open Graph, Twitter and noindex metadata', () => {
    const images = ['https://example.com/cover.png'];
    expect(buildMetadata({
      path: '/stories', title: 'Stories', description: 'Read our stories',
      type: 'article', images, noIndex: true,
    })).toMatchObject({
      title: 'Stories',
      description: 'Read our stories',
      alternates: { canonical: `${siteUrl}/stories` },
      openGraph: {
        type: 'article', url: `${siteUrl}/stories`, siteName: siteConfig.name,
        title: `Stories | ${siteConfig.name}`, description: 'Read our stories', images,
      },
      twitter: {
        card: 'summary_large_image', title: `Stories | ${siteConfig.name}`,
        description: 'Read our stories', images,
      },
      robots: { index: false, follow: true },
    });
  });

  it('applies defaults and omits noindex when optional values are absent', () => {
    const metadata = buildMetadata({ path: '/' });
    expect(metadata).toMatchObject({
      description: siteConfig.description,
      alternates: { canonical: `${siteUrl}/` },
      openGraph: { type: 'website', title: siteConfig.name },
      twitter: { title: siteConfig.name },
    });
    expect(metadata).not.toHaveProperty('title');
    expect(metadata).not.toHaveProperty('robots');
  });
});

describe('buildPaginatedMetadata', () => {
  it('keeps page one canonical and adds previous/next navigation for middle pages', () => {
    expect(buildPaginatedMetadata({
      basePath: '/courses', currentPage: 2, totalPages: 4,
      title: 'Courses', description: 'All courses',
    })).toMatchObject({
      title: 'Courses',
      alternates: { canonical: `${siteUrl}/courses` },
      openGraph: { url: `${siteUrl}/courses`, title: `Courses | ${siteConfig.name}` },
      twitter: { title: `Courses | ${siteConfig.name}` },
      other: [
        { rel: 'prev', href: `${siteUrl}/courses` },
        { rel: 'next', href: `${siteUrl}/courses?page=3` },
      ],
    });
  });

  it('handles first, last and single-page boundaries', () => {
    expect(buildPaginatedMetadata({ basePath: '/courses', currentPage: 1, totalPages: 3 }))
      .toHaveProperty('other', [{ rel: 'next', href: `${siteUrl}/courses?page=2` }]);
    expect(buildPaginatedMetadata({ basePath: '/courses', currentPage: 3, totalPages: 3 }))
      .toHaveProperty('other', [{ rel: 'prev', href: `${siteUrl}/courses?page=2` }]);
    const singlePage = buildPaginatedMetadata({ basePath: '/courses', currentPage: 1, totalPages: 1 });
    expect(singlePage).not.toHaveProperty('other');
    expect(singlePage).toMatchObject({
      description: siteConfig.description,
      openGraph: { type: 'website', title: siteConfig.name },
    });
  });
});
