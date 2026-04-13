import { z, defineCollection } from 'astro:content';

// ── Shared SEO fields (optional, non-breaking) ─────────────────────────
const seoFields = {
  ogImage: z.string().optional(),
};

// ── Works ───────────────────────────────────────────────────────────────
const worksCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    award: z.string().optional(),
    role: z.string().optional(),
    tags: z.array(z.string()).default([]),
    coverImage: z.string().optional(),
    videoSrc: z.string().optional(),
    videoPoster: z.string().optional(),
    order: z.number().default(0),
    ...seoFields,
  }),
});

// ── Series ──────────────────────────────────────────────────────────────
const seriesCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    theme_tags: z.array(z.string()).default([]),
    coverImage: z.string().optional(),
    ...seoFields,
  }),
});

// ── Writing ─────────────────────────────────────────────────────────────
const writingCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().min(1),
    seriesId: z.string().optional(),
    publishDate: z.date(),
    updatedDate: z.date().optional(),
    excerpt: z.string().optional(),
    coverImage: z.string().optional(),
    draft: z.boolean().default(false),
    ...seoFields,
  }),
});

export const collections = {
  works: worksCollection,
  series: seriesCollection,
  writing: writingCollection,
};
