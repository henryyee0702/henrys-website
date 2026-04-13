# Architecture Guide

> 個人作品集網站技術架構與開發規範

## 技術棧

| 層級 | 工具 | 職責 |
|------|------|------|
| 框架 | **Astro 4** | 靜態生成、檔案路由、島嶼架構 |
| UI | **React 18** | 互動元件（以 Astro `client:*` 指令按需 hydrate） |
| 樣式 | **Tailwind CSS 3** | 工具型 CSS，搭配 `global.css` 做全域變數 |
| 動畫 | **Framer Motion + GSAP** | 頁面動態與滾動驅動動畫 |
| 3D / WebGL | **Three.js** | 獎狀預覽、液態效果等重互動場景 |
| 型別 | **TypeScript (strict)** | 全站型別安全 |
| 內容 | **Astro Content Collections** | Markdown + Zod schema 驅動 |

## 資料夾結構

```
src/
├── components/
│   ├── layout/        # 導覽列、頁尾等全站框架元件
│   ├── sections/      # 頁面級區塊（首頁 Hero、時間軸…）
│   ├── ui/            # 可重用原子元件（游標、磁吸包裝…）
│   └── webgl/         # Three.js / shader 元件（隔離區）
├── content/           # Markdown 資料與 Zod schema
│   ├── config.ts      # Collection schema 定義
│   ├── works/         # 作品
│   ├── series/        # 系列
│   └── writing/       # 寫作
├── hooks/             # 共用 React hooks
├── layouts/           # Astro 佈局範本
├── pages/             # 檔案系統路由
└── styles/            # 全域 CSS
public/                # 靜態資源（圖片、字型、favicon）
```

## 匯入規範

**一律使用 `@/` 別名**，不使用相對路徑 `../`。

```ts
// ✅ 正確
import { Navigation } from '@/components/layout/Navigation';
import { useMediaQuery } from '@/hooks/useMediaQuery';

// ❌ 避免
import { Navigation } from '../../components/layout/Navigation';
```

別名在 `tsconfig.json` 與 `astro.config.mjs`（Vite resolve）同步設定。

## 元件分層規則

| 層級 | 資料夾 | 可否抓資料 | 可否管路由 | 常見 hydration |
|------|--------|-----------|-----------|---------------|
| Page | `pages/` | ✅ `getCollection()` | ✅ | — (Astro) |
| Layout | `layouts/` | ❌ | ❌ | — (Astro) |
| Section | `components/sections/` | ❌（props 傳入） | ❌ | `client:visible` / `client:idle` |
| UI | `components/ui/` | ❌ | ❌ | 由父層決定 |
| WebGL | `components/webgl/` | ❌ | ❌ | `client:visible` / `client:load` |

**關鍵原則**：
- **Page 保持薄**：只做資料查詢、排序、傳 props，不放排版邏輯。
- **Section 不抓資料**：所有資料由 Page 傳入，Section 只負責呈現與動畫。
- **WebGL 嚴格隔離**：不 import 非 webgl 資料夾的業務元件。

## Content Schema 規範

所有 collection 的 schema 定義在 `src/content/config.ts`，使用 Zod 驗證。

### 共用欄位
- `ogImage?: string` — 社群分享用圖

### Works
```yaml
title: string       # 必填，min(1)
description: string # 必填，min(1)
award?: string
role?: string
tags: string[]      # 預設 []
coverImage?: string
videoSrc?: string
videoPoster?: string
order: number       # 預設 0
```

### Writing
```yaml
title: string       # 必填，min(1)
seriesId?: string
publishDate: date   # 必填
updatedDate?: date
excerpt?: string
coverImage?: string
draft: boolean      # 預設 false
```

### Series
```yaml
title: string       # 必填，min(1)
description: string # 必填，min(1)
theme_tags: string[] # 預設 []
coverImage?: string
```

## WebGL 邊界規則

### 生命週期
1. **IntersectionObserver**：不在視窗內時暫停 render loop。
2. **Dispose**：`useEffect` cleanup 必須釋放 geometry、material、texture、renderer。
3. 共用工具：`src/components/webgl/dispose.ts` 提供 `disposeObject3D()` 與 `disposeRenderer()`。

### 退化策略
- **prefers-reduced-motion**：檢測到時跳過 WebGL，顯示靜態 fallback 圖片。
- **Error boundary**：載入失敗時顯示 `<img>` fallback，不崩潰整頁。

### Client-Only
- WebGL 元件只能在瀏覽器端執行。Astro 頁面使用 `client:visible` 或 `client:load`。
- 不要在 SSR 階段引用 `window`、`document`、`THREE`。

### 效能
- `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` — 限制像素比。
- Shadow map 解析度上限 2048。
- 優先使用 `ResizeObserver` 而非 `window.resize`。

## 開發指令

```bash
npm install          # 安裝相依
npm run dev          # 本機開發（熱重載）
npm run build        # 靜態建置
npm run preview      # 本機預覽建置結果
npx astro check      # TypeScript 型別檢查
```

## 新增內容流程

1. 在對應 `src/content/` 子資料夾新增 `.md` 檔。
2. frontmatter 必須符合 `config.ts` 的 Zod schema。
3. `npm run build` 會自動驗證 — schema 不符會報錯。
4. 路由由檔案名自動產生（slug = 檔名）。

## 新增元件流程

1. 判斷是 **UI 原子**、**頁面 Section**、還是 **WebGL** — 放對資料夾。
2. 使用 `@/` alias import。
3. WebGL 元件必須包含 dispose cleanup 與 reduced-motion check。
4. 在 `.astro` 頁面使用適當的 `client:*` 指令。
