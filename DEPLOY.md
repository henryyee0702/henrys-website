# 正式上線手冊 — pinhantseng.com

> **適用對象**：完全沒有網站部署經驗的使用者
> **最後更新**：2026-04-13（第三輪上線審判）

---

## 目錄

1. [購買網域](#一購買網域)
2. [把程式碼上傳到 GitHub](#二把程式碼上傳到-github)
3. [在 Vercel 部署網站](#三在-vercel-部署網站)
4. [綁定自訂網域](#四綁定自訂網域-pinhantsengcom)
5. [上線前檢查清單](#五上線前檢查清單)
6. [上線後檢查清單](#六上線後檢查清單)
7. [常見問題](#七常見問題)

---

## 一、購買網域

### 去哪裡買？

推薦使用 **[Namecheap](https://www.namecheap.com)**：
- 介面簡單、價格透明
- 第一年 `.com` 約 US$9–12
- 自動附贈隱私保護（WhoisGuard，免費）

備選：[Cloudflare Registrar](https://www.cloudflare.com/products/registrar/)（價格最低，無加價，但介面稍微技術化）

### 操作步驟

1. 前往 [namecheap.com](https://www.namecheap.com)
2. 在首頁搜尋框輸入 `pinhantseng.com`
3. 如果顯示「Available（可註冊）」，點選「Add to Cart（加入購物車）」
4. 結帳 → 建立帳號 → 付款（接受信用卡、PayPal）
5. 購買完成後，你會在 **Dashboard → Domain List** 看到 `pinhantseng.com`

> **買完之後你擁有的東西**：
> - 一個網域名稱（pinhantseng.com）
> - 管理 DNS 紀錄的權限（稍後設定）
> - 不需要現在做任何 DNS 設定，先做下面的步驟

---

## 二、把程式碼上傳到 GitHub

如果你的程式碼還沒在 GitHub 上，請依照以下步驟：

### 2.1 建立 GitHub 帳號

1. 前往 [github.com](https://github.com)，點「Sign up」
2. 輸入 email、密碼、使用者名稱，完成驗證

### 2.2 建立新的 Repository

1. 登入後，點右上角「+」→「New repository」
2. Repository name 填：`personal-website`（或任何你喜歡的名稱）
3. 設為 **Private**（私人，僅自己可見）
4. **不要**勾選「Add a README file」
5. 點「Create repository」

### 2.3 上傳程式碼

打開「終端機（Terminal）」（macOS 內建，按 `Cmd + Space` 搜尋「Terminal」），依序輸入：

```bash
cd ~/Desktop/Henry\'s\ Website

git init
git add .
git commit -m "Initial commit — ready for launch"
git branch -M main
git remote add origin https://github.com/你的帳號名稱/personal-website.git
git push -u origin main
```

> **注意**：把 `你的帳號名稱` 換成你真正的 GitHub 使用者名稱。
> 首次 push 時會要求登入 GitHub，照畫面指示操作即可。

---

## 三、在 Vercel 部署網站

### 為什麼選 Vercel？

- Astro 官方推薦的部署平台之一
- 免費方案完全夠用（個人作品集網站）
- 自動 HTTPS / SSL 憑證
- 每次 push 到 GitHub 會自動重新部署
- 自訂網域設定非常簡單

### 操作步驟

#### 3.1 註冊 Vercel

1. 前往 [vercel.com](https://vercel.com)
2. 點「Sign Up」→ 選「Continue with GitHub」
3. 授權 Vercel 存取你的 GitHub 帳號

#### 3.2 匯入專案

1. 登入後，點「Add New...」→「Project」
2. 在列表中找到你剛上傳的 `personal-website`，點「Import」
3. Vercel 會自動偵測這是 Astro 專案

#### 3.3 設定環境變數

在「Environment Variables」區塊：

| Key | Value |
|-----|-------|
| `SITE_URL` | `https://pinhantseng.com` |

> **重要**：這個環境變數會讓網站的 canonical URL、sitemap、OG 圖路徑都指向正式網域。

#### 3.4 確認建置設定

Vercel 通常會自動填入正確設定，確認以下欄位：

| 設定項目 | 值 |
|---------|-----|
| Framework Preset | Astro |
| Build Command | `npm run build` |
| Output Directory | `dist` |

如果 Vercel 自動偵測正確，不需要手動修改。

#### 3.5 點「Deploy」

等待約 1–2 分鐘。看到 **「Congratulations!」** 就代表部署成功。

此時你會得到一個 Vercel 提供的預覽網址，例如：
`https://personal-website-xxxxx.vercel.app`

你可以先用這個網址確認網站是否正常運作。

---

## 四、綁定自訂網域（pinhantseng.com）

### 4.1 在 Vercel 中新增網域

1. 進入你的 Vercel 專案頁面
2. 點上方的「Settings」
3. 左側選單點「Domains」
4. 在輸入框輸入 `pinhantseng.com`，點「Add」
5. Vercel 會顯示需要設定的 DNS 紀錄

### 4.2 在 Namecheap 設定 DNS

1. 登入 [Namecheap](https://www.namecheap.com)，進入 **Dashboard → Domain List**
2. 找到 `pinhantseng.com`，點「Manage」
3. 點上方的「Advanced DNS」分頁
4. 新增以下 DNS 紀錄：

**方法 A（推薦）：A Record + CNAME**

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A Record | `@` | `76.76.21.21` | Automatic |
| CNAME Record | `www` | `cname.vercel-dns.com` | Automatic |

> `76.76.21.21` 是 Vercel 的 IP。Vercel 頁面上會顯示這個值，以 Vercel 頁面顯示的為準。

5. 刪除 Namecheap 預設的任何舊 A 紀錄或 CNAME 紀錄（有衝突的那些）

### 4.3 等待 DNS 生效

- 通常 5 分鐘到 48 小時之間
- 大部分情況下 15–30 分鐘就會生效
- 在 Vercel 的 Domains 頁面，狀態會從 ⚠️ 變成 ✅

### 4.4 確認 SSL / HTTPS

- Vercel 會**自動**幫你申請免費的 SSL 憑證（Let's Encrypt）
- DNS 生效後，SSL 會在幾分鐘內自動啟用
- 確認方式：用瀏覽器打開 `https://pinhantseng.com`，看到網址列有 🔒 就代表成功

---

## 五、上線前檢查清單

在正式告訴別人你的網站網址前，請逐一確認：

### 頁面功能

- [ ] 首頁 (`/`) 正常顯示、動畫有載入
- [ ] 關於頁 (`/about`) 內容完整
- [ ] Writing (`/writing`) 列表正常、可點進文章
- [ ] Works (`/works/the-melting-time`) 作品頁正常
- [ ] Behind the Work (`/behind-the-work`) 正常
- [ ] 我的故事系列 (`/series/my-story`) 正常、文章列表完整
- [ ] 文章 prev/next 導航正確

### SEO 與分享

- [ ] 在瀏覽器打開 `https://pinhantseng.com/sitemap-index.xml`，確認有內容
- [ ] 在瀏覽器打開 `https://pinhantseng.com/robots.txt`，確認有內容
- [ ] 404 頁面：隨意輸入一個不存在的網址（如 `/asdfjkl`），確認出現中文 404 頁面
- [ ] 用 [opengraph.xyz](https://www.opengraph.xyz) 測試 `https://pinhantseng.com`，確認預覽圖正確

### 響應式 & 無障礙

- [ ] 手機版瀏覽正常（可用瀏覽器 DevTools 的手機模擬）
- [ ] iPad 版瀏覽正常

---

## 六、上線後檢查清單

網站正式上線、DNS 生效後：

- [ ] `https://pinhantseng.com` 可正常打開
- [ ] `https://www.pinhantseng.com` 會自動跳轉到 `https://pinhantseng.com`
- [ ] 網址列顯示 🔒（HTTPS 已啟用）
- [ ] 右鍵 → 檢視原始碼 → 搜尋 `og:image` → 確認路徑包含 `pinhantseng.com`
- [ ] 右鍵 → 檢視原始碼 → 搜尋 `canonical` → 確認是 `https://pinhantseng.com/`
- [ ] 複製網址到 LINE / Facebook / Twitter 的聊天框，確認預覽圖正確顯示
- [ ] 前往 [Google Search Console](https://search.google.com/search-console)，新增 `pinhantseng.com`，提交 sitemap
- [ ] Sitemap 網址填：`https://pinhantseng.com/sitemap-index.xml`

---

## 七、常見問題

### Q: 部署後網站顯示但 OG 圖不對？
**A**: 社群平台會快取舊的預覽圖。使用以下工具清除快取：
- Facebook: [Sharing Debugger](https://developers.facebook.com/tools/debug/)
- Twitter/X: [Card Validator](https://cards-dev.twitter.com/validator)
- LINE: 需等待自動更新（通常幾小時）

### Q: DNS 設定後很久還沒生效？
**A**: 先確認 DNS 紀錄填寫正確，然後等待。最長可達 48 小時，但通常半小時內搞定。可以用 [dnschecker.org](https://dnschecker.org) 查看全球 DNS 傳播狀態。

### Q: 我改了文章內容，怎麼更新線上版本？
**A**: 在終端機執行：
```bash
cd ~/Desktop/Henry\'s\ Website
git add .
git commit -m "更新內容"
git push
```
Vercel 會自動重新部署，約 1–2 分鐘後生效。

### Q: 未來想加新系列（如 Fulbright Diary、GRE Log）怎麼辦？
**A**: 在 `src/content/writing/` 新增 `.md` 文章，並設定 `seriesId` 對應到已有的系列 slug。有了文章後，那個系列就會自動出現在網站上。

### Q: Vercel 免費方案夠用嗎？
**A**: 完全夠用。免費方案包含：
- 每月 100GB 頻寬
- 自訂網域 + 自動 SSL
- 每次 git push 自動部署
- 個人作品集網站遠遠用不到上限

### Q: 如果以後想搬到別的平台？
**A**: 你的網站是標準的靜態 HTML 網站（Astro 建置產出），可以搬到任何支援靜態網站的平台（Netlify、Cloudflare Pages、GitHub Pages 等）。你的網域也可以隨時更改 DNS 指向。
