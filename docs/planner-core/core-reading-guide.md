# Core Reading Guide

## 閱讀順序建議

### 1. 先看型別，先不要急著追函式細節

先理解這幾個型別：

- `PlannerState`
- `Cost`
- `DrawHit`
- `PlanStep`
- `PlanResult`
- `PlannerConfig`

第一輪先問自己：

- 哪些欄位描述「當下狀態」？
- 哪些欄位描述「一步動作」？
- 哪些欄位描述「整體結果」？

## 2. 再看 config 與 cost helper

這一段主要在定義：

- 每種資源怎麼換算成等價成本
- 每種 pool 允許哪些 action
- 搜尋時有哪些保護機制與最佳化開關

這一層回答的是：

- 搜尋空間允許哪些操作？
- 搜尋演算法怎麼比較兩條路徑？

## 3. 然後看 target mask helpers

這段通常是多目標搜尋的核心。

重點不是記住 bit 操作，而是理解：

- 為什麼需要把目標貓映射成 index
- 為什麼命中狀態適合用 mask 表示
- `applyHit` 如何把「抽到某貓」轉成「目標進度更新」

## 4. 再看 draw simulation

這區通常是在回答：

- 如果做一次單抽，cursor 怎麼前進？
- `prev_cat_id` 為什麼要跟著更新？
- 十連或特殊行為是如何被拆解或模擬的？

這一段建議你搭配實際例子閱讀：

- 假設目前在 A1
- 假設前一隻貓是 X
- 假設做一次 single draw
- 看函式如何算出下一個 cursor、下一個 prev、以及 `DrawHit`

## 5. 最後看搜尋主流程

最後再去理解：

- priority queue 裡面放的是什麼
- 每次 pop 出來後怎麼展開下一層
- 何時判定成功
- 何時剪枝
- 何時停止

你可以特別觀察這幾種判斷：

- 是否已經 hit 所有 targets
- 是否超過 `max_expansions`
- 是否被更好的狀態支配

## 建議你邊看邊回答的問題

- `PlannerState` 裡哪個欄位最容易被忽略，但其實很重要？
- 如果拿掉 `mask`，結果會出什麼錯？
- 如果拿掉 `prev_cat_id`，模擬規則會在哪裡失真？
- 如果沒有 dominance pruning，效能會怎麼變？
- 為什麼 `Cost` 要同時保留等價成本與資源明細？

## 第二輪閱讀建議

第二輪可以嘗試自己畫出：

- 狀態轉移圖
- 單次抽卡造成的欄位變化
- 一條成功 plan 是如何由多個 `PlanStep` 組成
