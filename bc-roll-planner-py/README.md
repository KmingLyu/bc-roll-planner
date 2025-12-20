# BC Roll Planner

Battle Cats 抽卡模擬與預測工具，從 bc.godfat.org 抓取數據並分析抽卡軌跡。

## 功能特色

- 🎯 根據種子值（seed）預測抽卡結果
- 📊 顯示 A/B 雙軌道的抽卡路徑
- 🎲 支援三種抽卡模式：
  - **Normal**：單次抽卡（消耗 1 張票券）
  - **Guaranteed**：11 連抽保底（消耗 11 張票券，會跳躍位置並換線）
  - **Switch Track**：因重複貓咪觸發的換線機制
- 💾 可匯出完整的軌跡圖為 JSON 格式

## 安裝

```bash
pip install -r requirements.txt
```

主要依賴：

- requests：HTTP 請求
- beautifulsoup4：HTML 解析
- lxml：XML/HTML 解析器
- wcwidth：終端顯示寬度處理（支援中文對齊）

## 使用方法

### 基本用法

```bash
python main.py --seed <你的種子值> --event <活動代碼> --count <顯示格數>
```

### 範例

```bash
python main.py --seed 1234567890 --event 2025-12-12_1020 --count 50
```

### 參數說明

| 參數         | 必填 | 預設值                | 說明                              |
| ------------ | ---- | --------------------- | --------------------------------- |
| `--seed`     | ✅   | -                     | 種子值（10 位數字）               |
| `--event`    | ✅   | -                     | 活動代碼（格式：YYYY-MM-DD_NNNN） |
| `--count`    | ❌   | 50                    | 顯示的格數（建議 20-100）         |
| `--lang`     | ❌   | tw                    | 語言參數                          |
| `--ui`       | ❌   | tw                    | UI 語言參數                       |
| `--base-url` | ❌   | https://bc.godfat.org | 資料來源網址                      |
| `--export`   | ❌   | -                     | 匯出 JSON 檔案路徑                |

### 輸出格式

程式會以表格形式顯示抽卡結果：

```
1A   薩滿貓            [G -> 11B(空中戰艦貓咪Wunder)]      | 1B   幼稚園貓
2A   貓劍聖                                                | 2B   美腿貓         [S -> 3A(稀有貓)]
...
```

- **左欄**：貓咪名稱（normal 抽法會抽到的貓）
- **[G -> ...]**：使用 Guaranteed（11 連抽）會跳到的位置與貓咪
- **[S -> ...]**：觸發 Switch Track 會換到的位置與貓咪

### 匯出 JSON

```bash
python main.py --seed 1234567890 --event 2025-12-12_1020 --export output.json
```

匯出的 JSON 包含完整的軌跡圖結構，包括：

- 每個位置的貓咪資訊
- 所有可能的抽卡動作與結果
- 稀有度標記
- 跳躍與換線資訊

## 專案結構

- `main.py`：主程式與 CLI 介面
- `bc_roll_scraper.py`：網頁爬蟲與資料解析
- `bc_roll_models.py`：資料模型定義（Cat, Event, TrackGraph 等）

## 技術說明

本工具使用圖結構（TrackGraph）來表示抽卡軌跡：

- **PositionNode**：每個位置（如 3A、15B）
- **Edge**：每種抽卡動作（normal、guaranteed、switch_track）
- 自動處理軌道跳躍與換線邏輯

## 注意事項

- 種子值需要從遊戲中取得
- 活動代碼可從 bc.godfat.org 網站查詢
- 網路連線需穩定，會自動重試失敗的請求
- 支援繁體中文顯示與對齊

## License

請參考 LICENSE 檔案。
