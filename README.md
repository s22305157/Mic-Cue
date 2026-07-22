# Mic Cue PWA

Mic Cue 是離線優先的文字轉語音提示卡，資料只保留在目前裝置的瀏覽器 `localStorage`，不需要帳號、後端或 App Store。

## 本機開發（Windows）

1. 安裝 Node.js LTS：<https://nodejs.org/>
2. 在專案資料夾執行：

```powershell
npm install
npm run dev
```

Vite 會顯示本機網址。若要以同一個 Wi-Fi 的 iPhone 測試，執行：

```powershell
npm run dev -- --host
```

> iPhone 的語音與 PWA 安裝最好以 HTTPS 網址測試；本機 HTTP 僅適合檢查版面與基本操作。

## 生產建置

```powershell
npm run build
npm run preview
```

輸出位於 `dist/`。其中包含 manifest、Service Worker 及離線快取檔案。

## GitHub Pages 部署

1. 在 GitHub 建立新 repository，例如 `mic-cue`。
2. 將本資料夾的 PWA 檔案（`src/`、`public/`、`package.json`、`vite.config.ts` 等）推送到 `main` 分支。
3. 在 GitHub repository 新增 `.github/workflows/deploy.yml`，內容如下：

```yaml
name: Deploy PWA to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

4. 在 repository 的 **Settings → Pages → Build and deployment** 將 Source 設為 **GitHub Actions**。
5. 推送到 `main` 後，Actions 完成會提供 HTTPS 網址，例如 `https://<帳號>.github.io/mic-cue/`。

## iPhone Safari 安裝測試

1. 用 Safari 開啟 GitHub Pages 的 HTTPS 網址。
2. 確認能新增腳本、播放台詞；首次語音播放需由使用者點擊按鈕啟動。
3. 點 Safari 底部或上方的「分享」按鈕。
4. 選擇「加入主畫面」，確認名稱為 Mic Cue，然後按「加入」。
5. 從主畫面啟動，開啟一次後關閉網路，再重新開啟以檢查離線快取。

## iOS Safari SpeechSynthesis 已知限制

- 語音播放必須由使用者手勢（按鈕、鍵盤操作）啟動；頁面載入後不能自動朗讀。
- 可用語音會依 iPhone 安裝的系統語音、語言與版本而異；語音清單可能在頁面載入後才出現。
- iOS 可能在鎖定螢幕、切換 App、靜音模式或音訊中斷時停止或延遲播放。
- 長文字可能被 Safari 中斷；Mic Cue 設計為逐句播放，可降低這個影響。
- `localStorage` 與離線快取都在單一裝置／單一瀏覽器中，清除 Safari 網站資料會刪除腳本。請定期使用 JSON 匯出備份。
