import { describe, expect, it } from 'vitest';
import type { Course } from '@/types';
import { siteConfig, siteUrl } from './seo';
import { buildCourseJsonLd } from './structured-data';

const makeCourse = (overrides: Partial<Course> = {}): Course =>
  ({
    id: 'tailoring-101',
    title: 'Tailoring 101',
    description: '  Learn to sew.  ',
    price: 25,
    totalDuration: 3660,
    language: 'en',
    level: 'Beginner',
    category: 'Fashion',
    thumbnailUrl: 'https://example.com/course.jpg',
    rating: 4.5,
    reviewCount: 10,
    instructor: { name: '  Ada  ', stellarAddress: 'GABC', avatarUrl: null },
    ...overrides,
  }) as Course;

describe('buildCourseJsonLd', () => {
  it('builds a complete Course schema from representative course data', () => {
    const data = buildCourseJsonLd(makeCourse());
    const courseUrl = `${siteUrl}/courses/tailoring-101`;

    expect(data).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: 'Tailoring 101',
      description: 'Learn to sew.',
      url: courseUrl,
      image: 'https://example.com/course.jpg',
      inLanguage: 'en',
      educationalLevel: 'Beginner',
      about: 'Fashion',
      provider: { '@type': 'Organization', name: siteConfig.name, url: siteUrl },
      instructor: { '@type': 'Person', name: 'Ada' },
      aggregateRating: {
        '@type': 'AggregateRating', ratingValue: 4.5, reviewCount: 10,
        bestRating: 5, worstRating: 1,
      },
      offers: [{
        '@type': 'Offer', url: courseUrl, price: 25, priceCurrency: 'USD',
        category: 'Paid', availability: 'https://schema.org/InStock',
      }],
      hasCourseInstance: [{
        '@type': 'CourseInstance', courseMode: 'Online', courseWorkload: 'PT61M',
        instructor: { '@type': 'Person', name: 'Ada' },
      }],
    });
  });

  it('uses safe defaults and omits optional fields when data is missing', () => {
    const data = buildCourseJsonLd(makeCourse({
      description: '   ',
      price: 0,
      totalDuration: 0,
      language: '',
      level: '',
      category: '',
      thumbnailUrl: null,
      rating: 5,
      reviewCount: 0,
      instructor: { name: '   ', stellarAddress: 'GABC', avatarUrl: null },
    }));

    expect(data.description).toBe(`Learn Tailoring 101 on ${siteConfig.name}.`);
    expect(data.inLanguage).toBe('en');
    expect(data.offers[0]).toMatchObject({ price: 0, category: 'Free' });
    for (const field of ['image', 'educationalLevel', 'about', 'instructor', 'aggregateRating']) {
      expect(data).not.toHaveProperty(field);
    }
    expect(data.hasCourseInstance[0]).not.toHaveProperty('courseWorkload');
    expect(data.hasCourseInstance[0]).not.toHaveProperty('instructor');
  });
});
