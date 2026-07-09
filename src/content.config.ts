import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const TRUSTED_ASSET_ORIGINS = new Set(['https://res.cloudinary.com']);

const siteAssetUrl = z
  .string()
  .trim()
  .refine(
    (value) => {
      if (value.startsWith('/')) {
        return !value.startsWith('//');
      }

      try {
        const url = new URL(value);
        return url.protocol === 'https:' && TRUSTED_ASSET_ORIGINS.has(url.origin);
      } catch {
        return false;
      }
    },
    {
      message: 'Use a root-relative asset path or an HTTPS URL from an approved asset origin.',
    },
  );

const optionalSiteAssetUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  siteAssetUrl.optional(),
);

// ── Shared SEO fields (optional, non-breaking) ─────────────────────────
const seoFields = {
  ogImage: optionalSiteAssetUrl,
};

// ── Works ───────────────────────────────────────────────────────────────
const worksCollection = defineCollection({
  loader: glob({ base: './src/content/works', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    award: z.string().optional(),
    role: z.string().optional(),
    tags: z.array(z.string()).default([]),
    coverImage: optionalSiteAssetUrl,
    videoSrc: optionalSiteAssetUrl,
    videoPoster: optionalSiteAssetUrl,
    order: z.number().default(0),
    ...seoFields,
  }),
});

// ── Series ──────────────────────────────────────────────────────────────
const seriesCollection = defineCollection({
  loader: glob({ base: './src/content/series', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    theme_tags: z.array(z.string()).default([]),
    coverImage: optionalSiteAssetUrl,
    ...seoFields,
  }),
});

// ── Writing ─────────────────────────────────────────────────────────────
const writingCollection = defineCollection({
  loader: glob({ base: './src/content/writing', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string().min(1),
    seriesId: z.string().optional(),
    publishDate: z.date(),
    updatedDate: z.date().optional(),
    excerpt: z.string().optional(),
    coverImage: optionalSiteAssetUrl,
    draft: z.boolean().default(false),
    ...seoFields,
  }),
});

export const collections = {
  works: worksCollection,
  series: seriesCollection,
  writing: writingCollection,
};
