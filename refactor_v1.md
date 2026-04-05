## homepage 重新構架建議 v1

```bash
src/
├─ pages/
│  └─ HomePage.tsx                         # 只負責 layout + 組合各 section（很薄）
│
├─ hooks/
│  └─ useHomeController.ts                 # ⭐核心：整合 events/cats/graph/sim/planner 的資料流
│
├─ features/
│  ├─ events/
│  │  ├─ EventsSection.tsx                 # UI：event 類型切換 +（未來）多選
│  │  └─ useEvents.ts                      # 抓 upcoming/past
│  │
│  ├─ targetCats/
│  │  ├─ TargetCatsSection.tsx             # UI：tier 分組 + checkbox
│  │  └─ useEventCats.ts                   # 依 seed/count/(active events) 抓 cats
│  │
│  ├─ trackGraph/
│  │  ├─ TrackGraphSection.tsx             # UI：seed/count +（手動）fetch graph + summary/raw
│  │  └─ useTrackGraph.ts                  # 抓 graph（支援被 planner ensure）
│  │
│  ├─ simulator/
│  │  ├─ SimulatorSection.tsx              # UI：單抽/十連/重設 + log
│  │  └─ useSimulatorState.ts              # simulate append/reset 的 state 管理
│  │
│  └─ planner/
│     ├─ PlannerSection.tsx                # UI：資源表單 + Run planner（會呼叫 ensureGraph）
│     ├─ PlannerResultView.tsx             # 結果容器：summary + steps + raw
│     ├─ PlanStepsTable.tsx                # steps 表格（未來加「位置/命中標註」）
│     ├─ PlanDrawDetails.tsx               # draws 展開內容（未來標註命中點）
│     └─ usePlannerWorker.ts               # worker lifecycle + request sequencing
│
├─ ui/
│  ├─ SectionCard.tsx                      # 共用 Card 外框（MUI Card）
│  ├─ LoadStateView.tsx                    # 共用 loading/error 小元件
│  └─ JsonPreview.tsx                      # 共用 raw JSON 顯示（可折疊）
│
└─ uiTypes/
   └─ homeTypes.ts                         # CatTier/TierGroup/UiCat 等 UI 型別

```