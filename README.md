# BC Roll Planner

貓咪大戰爭轉蛋規劃工具：輸入 seed、選擇活動與目標貓咪，依持有資源規劃抽卡步驟。

## 功能

- 選擇近期或歷史活動與目標貓咪
- 輸入抽獎券、白金券、傳說券與貓罐頭
- 規劃單抽、十連與好康轉蛋的步驟，呈現換軌、保底、命中及資源用量
- 在桌面表格或手機卡片中檢視相同結果資料

## 技術與資料來源

- React 19、TypeScript、Vite、Tailwind CSS、Base UI
- Netlify Functions 從 [bc.godfat.org](https://bc.godfat.org) 取得活動、貓咪與軌道資料
- 規劃搜尋使用 A*／Dijkstra；抽卡轉移規則位於 `src/features/roll-rules/rollRules.ts`

## 本機執行

```bash
npm install
npx netlify dev
```

`netlify dev` 同時啟動 Vite 與 Functions；直接執行 `npm run dev` 只啟動前端。

## 檢查

```bash
npm test
npm run lint
npm run build
```

## 主要目錄

- `shared/models.ts`：前後端共用的活動、貓咪與軌道型別
- `netlify/functions/`：遠端資料取得、解析及軌道圖建構
- `src/features/roll-rules/`：單抽、十連、換軌與好康轉蛋的共用規則
- `src/features/planner/`：搜尋規劃、Worker、執行流程與結果資料
- `src/features/simulator/`：依指定操作序列模擬抽卡
- `src/features/events/`、`cats/`、`track-graph/`：活動、貓咪及軌道資料
- `src/app/`、`src/components/ui/`：應用程式入口與共用介面
- `tests/`：回歸測試
- `docs/architecture-refactor-plan.md`：本輪架構重構計畫

`tsconfig.app.json` 的 `@/*` 指向 `src/*`。
