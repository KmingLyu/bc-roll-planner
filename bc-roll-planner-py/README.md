# BC Roll Planner（Python）

Battle Cats 抽卡模擬與預測工具：從 **bc.godfat.org** 抓取活動資料，依據種子值（seed）建立 A/B 雙軌道抽卡路徑，支援單抽、11 連抽保底（Guaranteed）與換線（Switch Track）等行為的結果預測，並可匯出完整軌跡為 JSON。

> 本 README 對應 `bc-roll-planner-py/` 這個 Python 子專案。

---

## 功能特色

- 根據種子值（seed）預測抽卡結果
- 顯示 A/B 雙軌道的抽卡路徑
- 支援抽卡模式：
  - **Normal**：單次抽卡（消耗 1 張票券）
  - **Guaranteed**：11 連抽保底（消耗 11 張票券，會跳躍位置並換線）
  - **Switch Track**：因重複貓咪觸發的換線機制
- 可匯出完整的軌跡圖為 JSON 格式

---

## 安裝

建議使用 venv：

```bash
cd bc-roll-planner-py
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

主要依賴（以 `requirements.txt` 為準）：

- `requests`：HTTP 請求
- `beautifulsoup4`：HTML 解析
- `lxml`：HTML/XML 解析器
- `wcwidth`：終端顯示寬度處理（中文對齊）

---

## 使用方法（CLI）

### 基本用法

```bash
python main.py --seed <你的種子值> --event <活動代碼> --count <顯示格數>
```

### 範例

```bash
python main.py --seed 1234567890 --event 2025-12-12_1020 --count 50
```

### 參數

| 參數         | 必填 | 預設值                | 說明                              |
| ------------ | ---- | --------------------- | --------------------------------- |
| `--seed`     | ✅   | -                     | 種子值（通常為 10 位數字）        |
| `--event`    | ✅   | -                     | 活動代碼（格式：YYYY-MM-DD_NNNN） |
| `--count`    | ❌   | 50                    | 顯示的格數（建議 20-100）         |
| `--lang`     | ❌   | tw                    | 內容語言參數（來源站台用）        |
| `--ui`       | ❌   | tw                    | CLI 顯示用語言參數                |
| `--base-url` | ❌   | https://bc.godfat.org | 資料來源網址                      |
| `--export`   | ❌   | -                     | 匯出 JSON 檔案路徑                |

---

## 輸出格式

程式會以表格形式顯示抽卡結果（A/B 雙軌）：

```text
1A   薩滿貓            [G -> 11B(空中戰艦貓咪Wunder)]      | 1B   幼稚園貓
2A   貓劍聖                                                | 2B   美腿貓         [S -> 3A(稀有貓)]
...
```

- 左欄：A 軌道位置與該位置 normal 抽會得到的貓
- 右欄：B 軌道位置與該位置 normal 抽會得到的貓
- `[G -> ...]`：在該位置執行 Guaranteed 時的跳躍位置與結果（含換線）
- `[S -> ...]`：因重複貓咪觸發 Switch Track 時，換到的位置與結果

---

## 匯出 JSON（軌跡圖）

```bash
python main.py --seed 1234567890 --event 2025-12-12_1020 --export graph.json
```

匯出的 JSON 會包含完整軌跡圖結構（節點/邊/稀有度/跳躍與換線資訊）。

專案內的 `graph.json`、`graph001.json` 為匯出樣本（若存在）。

---

## 取得活動列表（抓 event code）

使用 `get_events.py` 抓取/列出活動，協助找到 `--event` 參數需要的活動代碼：

```bash
python get_events.py
```

---

## 模擬示範與文件

- `bc_roll_simulator.py`：模擬/走圖邏輯（normal/guaranteed/switch）
- `run_sim_demo.py`：模擬示範腳本
- `demo.md`：示範說明文件
- `table_example.html`：表格輸出/展示用範例
- `curls/`：抓取資料用的 curl 範例/紀錄（如有）

執行示範：

```bash
python run_sim_demo.py
```

---

## 專案結構（`bc-roll-planner-py/`）

```text
bc-roll-planner-py/
├── main.py                 # CLI 入口：解析參數、抓資料、建立圖並輸出/匯出
├── bc_roll_scraper.py      # 從 bc.godfat.org 抓取頁面並解析活動/池子資料
├── bc_roll_models.py       # 資料模型定義（Cat、Event、TrackGraph 等）
├── bc_roll_simulator.py    # 抽卡模擬/走圖邏輯（normal/guaranteed/switch）
├── get_events.py           # 抓取/列出活動代碼用腳本
├── run_sim_demo.py         # 模擬示範腳本
├── demo.md                 # 示範說明
├── curls/                  # 取得資料用的 curl 範例/紀錄（如有）
├── table_example.html      # 表格輸出示例
├── graph.json              # 匯出樣本（若存在）
├── graph001.json           # 匯出樣本（若存在）
├── requirements.txt        # Python 依賴
└── test/                   # 抓取/驗證腳本
    ├── bc_scraper.py
    └── scrape_events_test01.py
```

---

## 測試 / 驗證

`test/` 目錄目前包含抓取/驗證用腳本，可先直接執行單一檔案確認環境可用：

```bash
python test/scrape_events_test01.py
```

---

## 注意事項

- 種子值需自行取得；本專案不負責推導 seed。
- 活動代碼可由 `get_events.py` 或 `bc.godfat.org` 查詢。
- 終端顯示對齊依賴 `wcwidth`；若顯示錯位請確認依賴已安裝。

---

## License

請參考 `LICENSE` 檔案。
