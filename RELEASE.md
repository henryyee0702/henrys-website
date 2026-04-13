# Release Readiness — Audit Summary

> Three-round architecture audit completed. This document tracks verified state, known gaps, and pre-deploy checklist.
> **Round 3**: Final launch judgment — OG image, 404 page, sitemap cleanup, Vercel config, deployment runbook.

## Quality Gates (verified — Round 3)

| Gate | Result | Command |
|------|--------|---------|
| TypeScript | 0 errors, 0 warnings, 0 hints (46 files) | `npm run check` |
| Build | 17 pages + sitemap-index.xml | `npm run build` |
| ESLint | 0 errors, 0 warnings | `npm run lint` |

## What Was Fixed (Round 1 + Round 2)

### Round 1

| ID | Fix | Files |
|----|-----|-------|
| P0-1 | Draft leakage — `getStaticPaths` + `getPrevNext` use `filterPublished()` | `writing/[...slug].astro`, `lib/content.ts` |
| P0-2 | SEO infrastructure — auto-canonical, absolute OG URLs, default OG image | `Head.astro`, `astro.config.mjs`, `public/og-default.png` |
| P1-1 | Dead anchor `/#my-story` → `/` | `series/[...slug].astro`, `AchievementTimeline.tsx` |
| P1-2 | CI quality gates — ESLint flat config, blocking lint | `eslint.config.js`, `package.json`, `.github/workflows/ci.yml` |
| P2-1 | Reduced-motion — FulbrightGalaxy + ThermodynamicExhibit | `FulbrightGalaxy.tsx`, `ThermodynamicExhibit.tsx` |
| P2-3 | Content extraction — AchievementTimeline data → module | `achievements.ts` (new), `AchievementTimeline.tsx` |
| P3-1 | Dead code — 3 files deleted, 2 functions removed | Various |

### Round 2

| ID | Fix | Files |
|----|-----|-------|
| P0-A | Site domain env-driven (`SITE_URL` env var with fallback) | `astro.config.mjs` |
| P1-A | Empty series hidden from writing index | `writing/index.astro` |
| P1-B | Sitemap + robots.txt | `astro.config.mjs` (sitemap integration), `public/robots.txt` |
| P1-C | CinematicWorkHero reduced-motion — video hidden, poster shown | `CinematicWorkHero.tsx` |
| P2-A | FulbrightGalaxy content extraction — 372 lines → data module | `fulbright-episodes.ts` (new), `FulbrightGalaxy.tsx` |
| P2-B | Lint warnings resolved — all `no-explicit-any` fixed with proper types | `perf.ts`, `gpu-tier.ts` |
| Config | ESLint `process` global for astro config | `eslint.config.js` |
| Config | Sitemap version pinned to 3.2.1 (Astro 4 compatible) | `package.json` |

### Round 3

| ID | Fix | Files |
|----|-----|-------|
| P0-1 | Production OG image — replaced placeholder with brand 1200×630 PNG | `public/og-default.png` |
| P0-2 | 404 page — branded, bilingual, with CTA | `src/pages/404.astro` (new) |
| P1-1 | Sitemap cleanup — excluded 3 empty series from sitemap | `astro.config.mjs` |
| P1-2 | Navigation cleanup — removed empty Fulbright Diary link | `Navigation.tsx` |
| P1-3 | Security headers — X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy | `vercel.json` (new) |
| P1-4 | Deployment runbook — complete beginner guide in Traditional Chinese | `DEPLOY.md` (new) |

## Reduced-Motion Coverage

| Component | Strategy | Status |
|-----------|----------|--------|
| HomepageShowreel | CSS `motion-reduce:hidden` / `motion-reduce:block` | ✅ Already handled |
| HonorsHero | `useMediaQuery` + early return (skip GSAP) | ✅ Already handled |
| LiquidStatement | `reducedMotion` prop → plain text fallback | ✅ Already handled |
| FulbrightGalaxy | `useMediaQuery` + skip RAF loop | ✅ Round 1 |
| ThermodynamicExhibit | `useMediaQuery` + single static frame | ✅ Round 1 |
| CinematicWorkHero | CSS `motion-reduce:hidden` / `motion-reduce:block` for video | ✅ Round 2 |

## Pre-Deploy Checklist

- [x] **Replace OG image**: `public/og-default.png` is now the brand 1200×630 production image.
- [x] **404 page**: Custom branded 404 at `src/pages/404.astro`.
- [x] **Sitemap cleanup**: Empty series excluded from sitemap.
- [x] **Security headers**: `vercel.json` provides production-grade HTTP headers.
- [ ] **Purchase domain**: Buy `pinhantseng.com` (see `DEPLOY.md` for instructions).
- [ ] **Deploy to Vercel**: Import repo, set `SITE_URL=https://pinhantseng.com` (see `DEPLOY.md`).
- [ ] **DNS + SSL**: Point domain to Vercel, confirm HTTPS (see `DEPLOY.md`).
- [ ] **Test sitemap**: Verify `https://pinhantseng.com/sitemap-index.xml` is accessible.
- [ ] **Submit sitemap**: Add sitemap URL to Google Search Console.
- [ ] **Test OG preview**: Use [opengraph.xyz](https://www.opengraph.xyz) to verify social sharing image.
- [ ] **Test reduced-motion**: Toggle `prefers-reduced-motion: reduce` in DevTools.
- [ ] **Performance audit**: Run Lighthouse on deployed site.

## Known Gaps (not blockers)

1. **Empty series still build as pages** (`/series/fulbright-diary/`, `/series/gre-log/`, `/series/behind-the-work/`). Hidden from navigation, writing index, AND sitemap. URLs exist but are unreachable from normal browsing.
2. **Draft fix is untestable** — no `draft: true` content exists currently. The code is structurally correct.
3. **No analytics** — consider adding Plausible, Fathom, or similar privacy-respecting analytics after launch.
