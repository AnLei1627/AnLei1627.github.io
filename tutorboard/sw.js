/* TutorBoard service worker — 離線開啟（TASKS H9）。
 *
 * 這是範本：`build/swPlugin.ts` 在 `vite build` 時把 VERSION 與 FILES 換成這次建置的值，
 * 輸出成 dist/sw.js。不要手改 dist/sw.js。
 *
 * 行為
 * - install：開 `tutorboard-<VERSION>` 快取，逐一預先快取 FILES（單一檔案失敗只記 warning，
 *   不讓整個安裝失敗；只有 index.html 失敗才讓安裝失敗，瀏覽器下次開頁面會重試）。
 *   檔名含內容雜湊的檔案內容永遠不變，所以優先沿用舊版快取裡的同一檔、否則一般 fetch；
 *   其他檔案（index.html、public/ 的檔案）用 cache:'reload' 繞過 HTTP 快取拿最新的。
 * - activate：刪掉其他 `tutorboard-*` 快取，clients.claim()。
 * - fetch：只處理 scope 內的同源 GET。跨來源請求（AI 直接打 api.anthropic.com）完全不攔。
 *   導覽（含 ?board=<id>、?view=ai-panel）→ network-first，連不上就用快取的 index.html；
 *   其他 → cache-first，沒有才走網路，成功的同源回應順便存進目前的快取。
 *
 * 更新策略：不自動 skipWaiting()，也不顯示「有新版本」提示。
 * - 新版 SW 裝好後會等到所有用舊版的分頁都關閉才啟用（瀏覽器預設）。如果立刻接手，
 *   會刪掉舊快取，而 Pages 上的舊檔已被新部署取代，舊分頁之後才 lazy-load 的舊 chunk
 *   （例如第一次問 AI 才載入的 SDK）就會 404。
 * - 線上時導覽是 network-first，重新整理就會拿到最新版；只有「離線開啟」會用快取版本，
 *   可能比線上最新版舊一版，關掉所有分頁再開就更新。所以目前不需要提示 UI。
 * - 注意：之後若提高 IndexedDB 結構版本（src/storage/db.ts），舊版的離線頁面打開較新的 DB
 *   會失敗；到時要加「有新版本，關閉所有分頁後重新開啟即可更新」提示或 skipWaiting 流程。
 */

const VERSION = "9b1427bc8eef"
/** [相對於 scope 的路徑, 檔名是否含內容雜湊] */
const FILES = [
  ["assets/ClassDialog-D2drbo6J.js",true],
  ["assets/ClassDialog-DqEkpd7g.css",true],
  ["assets/KaTeX_AMS-Regular-BQhdFMY1.woff2",true],
  ["assets/KaTeX_Caligraphic-Bold-Dq_IR9rO.woff2",true],
  ["assets/KaTeX_Caligraphic-Regular-Di6jR-x-.woff2",true],
  ["assets/KaTeX_Fraktur-Bold-CL6g_b3V.woff2",true],
  ["assets/KaTeX_Fraktur-Regular-CTYiF6lA.woff2",true],
  ["assets/KaTeX_Main-Bold-Cx986IdX.woff2",true],
  ["assets/KaTeX_Main-BoldItalic-DxDJ3AOS.woff2",true],
  ["assets/KaTeX_Main-Italic-NWA7e6Wa.woff2",true],
  ["assets/KaTeX_Main-Regular-B22Nviop.woff2",true],
  ["assets/KaTeX_Math-BoldItalic-CZnvNsCZ.woff2",true],
  ["assets/KaTeX_Math-Italic-t53AETM-.woff2",true],
  ["assets/KaTeX_SansSerif-Bold-D1sUS0GD.woff2",true],
  ["assets/KaTeX_SansSerif-Italic-C3H0VqGB.woff2",true],
  ["assets/KaTeX_SansSerif-Regular-DDBCnlJ7.woff2",true],
  ["assets/KaTeX_Script-Regular-D3wIWfF6.woff2",true],
  ["assets/KaTeX_Size1-Regular-mCD8mA8B.woff2",true],
  ["assets/KaTeX_Size2-Regular-Dy4dx90m.woff2",true],
  ["assets/KaTeX_Size4-Regular-Dl5lxZxV.woff2",true],
  ["assets/KaTeX_Typewriter-Regular-CO6r4hn1.woff2",true],
  ["assets/claude-B7htuwL-.js",true],
  ["assets/e2e-DVAZ49Cc.js",true],
  ["assets/error-BTdmRKoB.js",true],
  ["assets/katex-BYLiqMcl.js",true],
  ["assets/latency-CFYUxHTb.js",true],
  ["assets/localChannel-CLTH2tRx.js",true],
  ["assets/main-CR0tFMow.css",true],
  ["assets/main-CxGBmc3N.js",true],
  ["assets/marked.esm-CF3wyUyR.js",true],
  ["assets/node.browser-HQ5SKBOf.js",true],
  ["assets/node.browser-SdRfNXzP.js",true],
  ["assets/pointer-bOBtX2ym.js",true],
  ["assets/relay-D9Z-agTp.js",true],
  ["assets/session-D1g_oA8A.js",true],
  ["assets/types-CFU0twbU.js",true],
  ["assets/yjs-ByfhKFdh.js",true],
  ["favicon.svg",false],
  ["icons.svg",false],
  ["index.html",false],
  ["manifest.webmanifest",false],
]

const CACHE_PREFIX = 'tutorboard-'
const CACHE = CACHE_PREFIX + VERSION
const SCOPE = self.registration.scope
const INDEX_URL = new URL('index.html', SCOPE).href

self.addEventListener('install', (event) => {
  event.waitUntil(precache())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith(CACHE_PREFIX) && key !== CACHE) await caches.delete(key)
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || !req.url.startsWith(SCOPE)) return
  // DevTools 會發 only-if-cached 請求，非 same-origin 模式時 fetch() 會丟錯（Chrome 已知問題）
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return
  event.respondWith(req.mode === 'navigate' ? networkFirst(req) : cacheFirst(event, req))
})

async function precache() {
  const cache = await caches.open(CACHE)
  const failed = []
  await Promise.all(
    FILES.map(async ([path, hashed]) => {
      const url = new URL(path, SCOPE).href
      try {
        let res = hashed ? await caches.match(url) : undefined
        if (!res) res = await fetch(new Request(url, { cache: hashed ? 'default' : 'reload' }))
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        await cache.put(url, cleanRedirect(res))
      } catch (err) {
        failed.push(path)
        console.warn('[sw] 預先快取失敗', path, err)
      }
    }),
  )
  if (failed.includes('index.html')) throw new Error('[sw] index.html 預先快取失敗，安裝中止')
}

async function networkFirst(req) {
  try {
    return await fetch(req)
  } catch (err) {
    const cache = await caches.open(CACHE)
    // 不管 query（?board=…、?view=ai-panel）都是同一個 index.html
    const shell = await cache.match(INDEX_URL, { ignoreSearch: true, ignoreVary: true })
    if (shell) return shell
    throw err
  }
}

async function cacheFirst(event, req) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(req, { ignoreVary: true })
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok && res.type === 'basic') event.waitUntil(cache.put(req, res.clone()).catch(() => {}))
  return res
}

/** 被轉址過的 response 不能拿來回應導覽請求，存之前先複製成乾淨的 */
function cleanRedirect(res) {
  if (!res.redirected) return res
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers })
}
