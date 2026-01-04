# BC Roll Planner React 架構 v1

```
bc-roll-planner-react/
├─ netlify/
│  └─ functions/
│     ├─ events.ts              # 對應 get_upcoming_events / get_past_events
│     ├─ trackGraph.ts          # 對應 build_track_graph + parse tracks table
│     └─ _lib/
│        ├─ http.ts             # fetch + retry/backoff + headers
│        ├─ parseEvents.ts      # 解析首頁 events select
│        ├─ parseTrackTable.ts  # 解析 tracks table -> PickCell map
│        ├─ buildGraph.ts       # PickCell -> PositionNode/Edge -> TrackGraph
│        └─ normalize.ts        # normalize_text / regex helpers
│
├─ src/                         # React app
│  ├─ app/
│  │  ├─ App.tsx
│  │  └─ routes.tsx
│  ├─ pages/
│  │  ├─ HomePage.tsx           # seed/count/events/targets/resources
│  │  ├─ GraphPage.tsx          # 檢視 TrackGraph
│  │  └─ PlannerPage.tsx        # 跑 plan_min_cost 並顯示結果
│  ├─ components/
│  │  ├─ EventPicker.tsx
│  │  ├─ TargetInput.tsx
│  │  ├─ ResourceForm.tsx
│  │  ├─ PlanResultView.tsx
│  │  └─ DrawTable.tsx
│  ├─ api/
│  │  ├─ netlifyClient.ts       # 呼叫 /.netlify/functions/*
│  │  ├─ eventsApi.ts
│  │  └─ trackGraphApi.ts
│  ├─ core/                     # ✅ TS 版演算法（前端用）
│  │  ├─ simulator.ts           # simulate / choose_edge_for_single_draw / parse_actions
│  │  ├─ planner.ts             # plan_min_cost (Dijkstra)
│  │  └─ utils.ts               # parse_pos_id / apply_hit / cost helpers
│  ├─ workers/
│  │  └─ planner.worker.ts      # （建議）把 plan_min_cost 放 worker
│  └─ store/
│     ├─ useAppStore.ts         # Zustand/Redux 皆可
│     └─ persistence.ts         # localStorage cache graphs/results
│
├─ shared/                      # ✅（可選，但很推薦）前後端共用型別/純函式
│  ├─ models.ts                 # 同 core/models.ts（或反過來讓 core 引用 shared）
│  └─ validators.ts             # zod schemas（function 回傳也驗）
│
├─ netlify.toml                 # 建議保留（路由/headers/本地 dev）
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```