# BC Roll Planner React 架構 v1

```markdown
bc-roll-planner-react/
├── index.html                       # Vite SPA 入口 HTML（掛載 root、載入 main.tsx、設定 title/favicon 等）
├── netlify.toml                     # Netlify 部署設定（build/redirects/functions 設定與環境變數等）
├── netlify
│   └── functions                    # Netlify Functions（後端 API：抓資料、解析、組 graph）
│       ├── _lib                     # Functions 共用工具與解析模組
│       │   ├── buildGraph.ts        # 由 tracks/解析結果組出 TrackGraph（A/B 軌、保底、換軌等邊）
│       │   ├── env.ts               # Functions 端環境變數與預設值讀取（例如 base_url/lang/ui 等）
│       │   ├── http.ts              # 伺服端 HTTP 抓取工具（fetch + retry/timeout/headers 等）
│       │   ├── normalize.ts         # 解析結果正規化（字串清理、欄位對齊、型別轉換）
│       │   ├── parseEventCats.ts    # 解析活動頁的貓池內容（分組、稀有度 tiers、貓名/描述）
│       │   ├── parseEvents.ts       # 解析活動列表頁（upcoming/past）成 Event 清單
│       │   └── parseTrackTable.ts   # 解析轉蛋軌道表（A/B 位置、貓、保底/換軌資訊等）
│       ├── eventCats.ts             # API：回傳指定活動可抽到的貓與分組（供前端 TargetCatsPicker）
│       ├── events.ts                # API：回傳活動列表（upcoming + past）供前端選擇
│       └── trackGraph.ts            # API：回傳指定活動的 TrackGraph（供 planner/simulator 使用）
├── shared
│   └── models.ts                    # 前後端共用型別（Event/TrackGraph/Cat/Edge 等單一真實來源）
├── src
│   ├── App.css                      # App 全域樣式（少量補強與覆寫）
│   ├── App.tsx                      # App 根元件（Router/頁面框架、共用 Layout）
│   ├── index.css                    # 全站基礎 CSS（reset、字體、body 背景等）
│   ├── main.tsx                     # React 入口（createRoot、掛載 App、注入 providers）
│   ├── config
│   │   └── bcEnv.ts                 # 前端環境設定（讀 Vite env、組出 bc.godfat 相關參數）
│   ├── api
│   │   ├── eventCatsApi.ts          # 前端呼叫 eventCats function 的 API wrapper（含 query 組裝）
│   │   ├── eventsApi.ts             # 前端呼叫 events function 的 API wrapper（活動列表請求）
│   │   ├── netlifyClient.ts         # Netlify functions HTTP client（錯誤處理、base path、typing）
│   │   └── trackGraphApi.ts         # 前端呼叫 trackGraph function 的 API wrapper（抓 graph）
│   ├── components
│   │   ├── cats
│   │   │   └── TargetCatsPicker.tsx # 目標貓選擇器（依 eventCats 分組顯示、選取目標）
│   │   ├── events
│   │   │   └── EventsPicker.tsx     # 活動選擇器（upcoming/past 分區、顯示活動名稱與資訊）
│   │   ├── graph
│   │   │   └── GraphSummaryCard.tsx # TrackGraph 摘要卡（顯示 seed/count、軌道資訊摘要）
│   │   ├── inputs
│   │   │   └── SeedCountForm.tsx    # seed/count 輸入表單（規劃與抓 graph 需要的參數）
│   │   ├── layout
│   │   │   ├── ControlPanel.tsx     # 右側/上方控制面板（UI flags、開關、表單集合）
│   │   │   └── Section.tsx          # 版面區塊容器（標題、間距、一致化樣式的 wrapper）
│   │   ├── planner
│   │   │   ├── EventTrackGraphsView.tsx   # 規劃結果：依 event 畫出 A/B 軌視覺化與標記步驟
│   │   │   ├── PlanDrawsTimelineTable.tsx # 規劃結果：抽卡步驟時間軸表（A/B lane、命中/保底）
│   │   │   ├── PlannerRunBar.tsx          # 規劃執行控制列（Run/Loading/狀態提示/摘要）
│   │   │   ├── PlanResultStatsCard.tsx    # 規劃結果統計卡（成本、資源消耗、命中數等）
│   │   │   ├── planViewModel.ts           # 規劃結果的 view model（label、狀態樣式、顯示轉換）
│   │   │   └── ResourceForm.tsx           # 規劃輸入：資源表單（金券/白金/傳說/罐頭等）
│   │   ├── simulator
│   │   │   └── SimulatorPanel.tsx    # 模擬面板（用 graph 跑模擬、顯示抽卡結果/測試）
│   │   └── tools
│   │       └── NumberField.tsx       # 自訂數字輸入元件（包裝 MUI NumberField/輸入限制）
│   ├── core
│   │   ├── planner.ts                # 核心規劃演算法（資源成本、最短路徑/策略、輸出 PlanResult）
│   │   ├── simulator.ts              # 核心模擬器（單抽/十連抽規則、走邊、更新 cursor/prev_cat）
│   │   └── utils.ts                  # 核心共用工具（posId 解析、lane/track 操作、小工具函式）
│   ├── hooks
│   │   ├── useEventCats.ts           # Hook：取得 eventCats（快取、loading/error、分組整理）
│   │   ├── useEvents.ts              # Hook：取得 events（upcoming/past 合併、狀態管理）
│   │   ├── usePlannerWorker.ts       # Hook：用 Web Worker 跑 planner（避免阻塞 UI、回傳結果）
│   │   └── useTrackGraphs.ts         # Hook：取得 trackGraph（依 event/seed/count 抓取與快取）
│   ├── pages
│   │   ├── HomePage.tsx              # 首頁（入口導覽、簡介、連到 Planner/Simulator 等）
│   │   └── PlannerPage.tsx           # 規劃頁（整合表單、抓 graph、跑 planner、呈現結果）
│   └── workers
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```