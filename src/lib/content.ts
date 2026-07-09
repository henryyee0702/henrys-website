/**
 * Content domain utilities.
 *
 * Centralises every piece of content-derivation logic that was previously
 * duplicated across pages: querying, filtering, sorting, prev/next,
 * series association, date formatting, and presentational mapping.
 */
import { getCollection, type CollectionEntry } from 'astro:content';

// ── Type aliases ────────────────────────────────────────────────────────
export type WritingEntry = CollectionEntry<'writing'>;
export type WorkEntry    = CollectionEntry<'works'>;
export type SeriesEntry  = CollectionEntry<'series'>;

// ── Date formatting ─────────────────────────────────────────────────────
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function formatDateLong(date: Date): string {
  return date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatDateMonth(date: Date): string {
  return date.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' });
}

// ── Day-label extraction (e.g. "Day 3") ─────────────────────────────────
export function getDayLabel(title: string): string {
  return title.match(/^Day\s*\d+/i)?.[0] ?? 'Story';
}

// ── Generic sort helpers ────────────────────────────────────────────────
export function sortByDateDesc<T extends { data: { publishDate: Date } }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf());
}

export function sortByDateAsc<T extends { data: { publishDate: Date } }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => a.data.publishDate.valueOf() - b.data.publishDate.valueOf());
}

// ── Draft filter ────────────────────────────────────────────────────────
export function filterPublished(entries: WritingEntry[]): WritingEntry[] {
  return entries.filter(e => !e.data.draft);
}

// ── Query: all published writing, newest-first ──────────────────────────
export async function getPublishedWriting(): Promise<WritingEntry[]> {
  const all = await getCollection('writing');
  return sortByDateDesc(filterPublished(all));
}

// ── Query: posts belonging to a series ──────────────────────────────────
export async function getSeriesPosts(
  seriesId: string,
  order: 'newest' | 'oldest' = 'newest',
): Promise<WritingEntry[]> {
  const all = await getCollection('writing');
  const filtered = filterPublished(all).filter(p => p.data.seriesId === seriesId);
  return order === 'newest' ? sortByDateDesc(filtered) : sortByDateAsc(filtered);
}

// ── Prev / Next within a pool ───────────────────────────────────────────
export interface PrevNext {
  prev: WritingEntry | null;
  next: WritingEntry | null;
}

export async function getPrevNext(
  entry: WritingEntry,
  order: 'newest' | 'oldest' = 'newest',
): Promise<PrevNext> {
  const all = await getCollection('writing');
  const published = filterPublished(all);
  const pool = entry.data.seriesId
    ? published.filter(p => p.data.seriesId === entry.data.seriesId)
    : published;

  const sorted = order === 'newest' ? sortByDateDesc(pool) : sortByDateAsc(pool);
  const idx = sorted.findIndex(p => p.id === entry.id);

  return {
    prev: idx > 0 ? sorted[idx - 1] : null,
    next: idx < sorted.length - 1 ? sorted[idx + 1] : null,
  };
}

// ── Group writing by series ─────────────────────────────────────────────
export interface GroupedWriting {
  seriesMap: Map<string, WritingEntry[]>;
  standalone: WritingEntry[];
}

export function groupBySeries(entries: WritingEntry[]): GroupedWriting {
  const seriesMap = new Map<string, WritingEntry[]>();
  const standalone: WritingEntry[] = [];

  for (const post of entries) {
    if (post.data.seriesId) {
      const bucket = seriesMap.get(post.data.seriesId) ?? [];
      bucket.push(post);
      seriesMap.set(post.data.seriesId, bucket);
    } else {
      standalone.push(post);
    }
  }
  return { seriesMap, standalone };
}

// ── MyStory feed item mapping (used by home + series pages) ─────────────
export interface StoryFeedItem {
  href: string;
  title: string;
  excerpt: string;
  coverImage: string;
  dayLabel: string;
  dateLabel: string;
}

export function toStoryFeedItems(
  posts: WritingEntry[],
  dateFmt: (d: Date) => string = formatDateMonth,
): StoryFeedItem[] {
  return posts.map(post => ({
    href: `/writing/${post.id}`,
    title: post.data.title,
    excerpt: post.data.excerpt ?? '',
    coverImage: post.data.coverImage ?? '',
    dayLabel: getDayLabel(post.data.title),
    dateLabel: dateFmt(post.data.publishDate),
  }));
}
