import type { DrawTableColumn } from "../types";
import type { ActionLabel } from "../../../logic/view-model";
import { ResourceImg } from "../../ResourceImg";
import { StepLane } from "../ui/StepLane";

import { Box, IconButton } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

function makeLaneColumn(
  lane: "A" | "B",
  opts?: { widthKey?: "A" | "B"; widthPct?: number },
): DrawTableColumn {
  return {
    id: lane,
    widthKey: opts?.widthKey,
    widthPct: opts?.widthPct,
    render: (r, ctx) => {
      const isEllipsis = r.countText === "⋯";
      const isGuaranteedRow =
        r.statusA === "guaranteed" || r.statusB === "guaranteed";

      return (
        <StepLane
          lane={lane}
          countText={r.countText}
          text={lane === "A" ? r.A : r.B}
          status={lane === "A" ? r.statusA : r.statusB}
          isTarget={!isEllipsis && (lane === "A" ? r.isTargetA : r.isTargetB)}
          isDuplicate={
            !isEllipsis && (lane === "A" ? r.isDuplicateA : r.isDuplicateB)
          }
          hasNext={ctx.hasNextInBlock}
          isEllipsis={isEllipsis}
          hideLane={
            isGuaranteedRow &&
            (lane === "A" ? r.statusA : r.statusB) !== "guaranteed"
          }
        />
      );
    },
  };
}

export function makeMainColumns(): DrawTableColumn[] {
  const columns: DrawTableColumn[] = [
    {
      id: "action",
      widthKey: "action",
      render: (r, ctx) => {
        return (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              // gap: 1,
              minWidth: 0, // ✅ 讓 cell 允許縮小，避免撐爆
              width: "100%",
            }}
          >
            {/* toggle / placeholder */}
            {ctx.countCell.kind === "toggle" ? (
              <IconButton
                size="small"
                onClick={ctx.countCell.onToggle}
                aria-label={ctx.countCell.ariaLabel || "toggle"}
                sx={{ flex: "0 0 auto" }}
              >
                {ctx.countCell.open ? (
                  <KeyboardArrowUpIcon />
                ) : (
                  <KeyboardArrowDownIcon />
                )}
              </IconButton>
            ) : (
              <Box sx={{ width: 34, flex: "0 0 34px" }} />
            )}

            <Box
              sx={{
                minWidth: 0,
                flex: "1 1 auto",
                overflow: "hidden",
              }}
            >
              <ResourceImg label={r.actionText as ActionLabel} height={40} />
            </Box>
          </Box>
        );
      },
    },
    makeLaneColumn("A", { widthKey: "A" }),
    makeLaneColumn("B", { widthKey: "B" }),
  ];

  return columns;
}

export function makeDetailColumns(): DrawTableColumn[] {
  return [
    makeLaneColumn("A", { widthPct: 50 }),
    makeLaneColumn("B", { widthPct: 50 }),
  ];
}

export function makeDefaultColumns(): DrawTableColumn[] {
  return makeMainColumns();
}

/**
 * 你之後想加欄位，只要 push 一個 column 即可，例如：
 *
 * columns.push({
 *   id: "note",
 *   widthPct: 20,
 *   render: (r) => <span style={{ fontSize: 12 }}>{r.note}</span>
 * })
 *
 * 不需要去改 DrawTableRow / StepBlock / TenCollapseRow。
 */
