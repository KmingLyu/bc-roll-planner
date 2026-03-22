import type React from "react";
import type { SxProps, Theme } from "@mui/material/styles";
import type { DrawRow } from "../../logic/view-model";

export type ColW = {
  action: number;
  A: number;
  B: number;
};

export type BodyCellSx = SxProps<Theme>;

export type EventRunMeta = {
  eventValue: string;
  eventName: string;
  eventRawName: string;
  eventStartDate: string | null;
  eventEndDate: string | null;
  color: string;
  tint: string;
  isStart: boolean;
  isEnd: boolean;
};

export type EventGroupChrome = {
  color: string;
  tint: string;
  isEnd: boolean;
};

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
  eventGroupChrome?: EventGroupChrome | null;

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
