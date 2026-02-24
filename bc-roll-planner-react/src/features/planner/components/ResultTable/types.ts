import type React from "react";
import type { DrawRow } from "../../logic/view-model";

export type ColW = {
  count: number;
  step: number;
  action: number;
  event: number;
  A: number;
  B: number;
};

export type BodyCellSx = Record<string, any>;

export type CountCellMode =
  | { kind: "toggle"; open: boolean; onToggle: () => void; ariaLabel?: string }
  | { kind: "spacer" };

export type RowRenderCtx = {
  colW: ColW;
  bodyCellSx: BodyCellSx;

  eventColorOf: (ev: string) => string;
  eventTintOf: (ev: string) => string;

  hasNextInBlock: boolean;
  countCell: CountCellMode;

  onRowContextMenu?: (row: DrawRow, e: React.MouseEvent) => void;
};

export type DrawTableColumn = {
  id: string;
  widthKey?: keyof ColW; // 用 colW 的百分比欄寬
  widthPct?: number; // 或直接指定百分比（會覆蓋 widthKey）
  align?: "left" | "center" | "right";

  /**
   * render cell content
   * - 不建議在這裡做重計算，只做顯示
   */
  render: (row: DrawRow, ctx: RowRenderCtx) => React.ReactNode;
};
