# Planner Core Notes

這個資料夾用來整理 `src/features/planner/logic/core.ts` 的學習筆記。

## 目標

- 建立對 planner 核心演算法的整體心智模型
- 把閱讀過程中的問題、假設、驗證結果記錄下來
- 將「型別 / 狀態 / 搜尋流程 / 剪枝策略」拆開理解

## 建議閱讀順序

1. [core-overview.md](./core-overview.md)
2. [core-reading-guide.md](./core-reading-guide.md)
3. 打開 [`core.ts`](../../src/features/planner/logic/core.ts) 對照閱讀
4. 對照 [`rollRules.ts`](../../src/features/roll-rules/rollRules.ts) 理解抽卡規則與搜尋的分工

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
- `../../src/features/roll-rules/rollRules.ts`
  - 單抽、十連及好康轉蛋的共用轉移規則
