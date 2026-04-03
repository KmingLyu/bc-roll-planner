# Planner Core Notes

這個資料夾用來整理 `bc-roll-planner-react/src/features/planner/logic/core.ts` 的學習筆記。

## 目標

- 建立對 planner 核心演算法的整體心智模型
- 把閱讀過程中的問題、假設、驗證結果記錄下來
- 將「型別 / 狀態 / 搜尋流程 / 剪枝策略」拆開理解

## 建議閱讀順序

1. [core-overview.md](./core-overview.md)
2. [core-reading-guide.md](./core-reading-guide.md)
3. 打開 [`core.ts`](/Users/keming/Workspace/bc-roll-planner/bc-roll-planner-react/src/features/planner/logic/core.ts) 對照閱讀
4. 把自己的理解與疑問寫進 [study-log.md](./study-log.md)

## 核心問題

- planner 想最佳化的到底是什麼？
- 搜尋狀態由哪些欄位組成？
- 每一次展開節點時，實際上做了哪些事情？
- A* heuristic 和 dominance pruning 分別在幫忙解什麼問題？
- `DrawHit`、`PlanStep`、`PlanResult` 分別對應哪一層抽象？

## 檔案說明

- `core-overview.md`
  - 用高層次語言整理 planner 在做什麼
- `core-reading-guide.md`
  - 把 `core.ts` 拆成幾個區塊，方便逐段閱讀
- `study-log.md`
  - 你的學習紀錄與筆記模板
