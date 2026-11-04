# anlei1627.github.io

| 路徑 | 內容 |
| :--- | :--- |
| `/` | 首頁（列出底下的東西） |
| `/tutoring-availability/` | 家教可上課時段（中英雙語，自動換算訪客時區） |

要放新東西：開一個子資料夾，再到根目錄 `index.html` 的清單加一行連結。

---

## Tutoring Availability

| 檔案 | 用途 |
| :--- | :--- |
| `index.html` | 公開頁，學生／家長看的，唯讀 |
| `edit.html` | **編輯頁**，只有你能儲存（需要 GitHub 金鑰） |
| `availability.json` | 時段資料，上面兩頁都讀它 |
| `tz.js` | 時區換算工具 |

### 三種更新方式

1. **編輯頁**（手機、電腦都可以）：`https://anlei1627.github.io/tutoring-availability/edit.html`
   - 第一次打開會引導你建立 GitHub fine-grained token（只給這個 repo 的 Contents 讀寫權限），金鑰只存在那台裝置的瀏覽器
   - 加／刪時段、改時間、勾「已約」、切換時區、改公告，按「儲存」，約 1 分鐘後公開頁更新
   - 「複製本週到下週」：把本週（一到日）的時段原樣複製到下週，已約的會變回開放
2. **請 AI 改**：直接改 `availability.json`
3. **GitHub 網頁**：在 repo 裡點 `availability.json` → 鉛筆圖示編輯

### `availability.json` 格式

```json
{
  "updated": "2026-11-04",
  "timezone": "America/New_York",
  "notice": { "zh": "…", "en": "…" },
  "slots": [
    { "date": "2026-11-05", "start": "06:00", "end": "08:30" },
    { "date": "2026-11-05", "start": "07:00", "end": "08:00", "booked": true }
  ]
}
```

- `timezone`：時段用哪個時區的時間寫；單筆可用 `tz` 覆寫（編輯頁存檔時會統一換掉）
- `booked: true`：被訂走的時間，公開頁會從開放時段扣掉。訂走一部分時，新增一段只涵蓋那部分並打勾
- `end` 早於 `start` = 跨午夜
- 已過去的時間自動隱藏；剩不到 1 小時的零碎空檔不顯示；編輯頁存檔時會清掉 7 天前的舊資料
- **這是公開檔案，不要寫學生名字或地點**
