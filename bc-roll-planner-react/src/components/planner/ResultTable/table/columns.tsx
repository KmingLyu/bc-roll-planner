import type { DrawTableColumn } from "../types";
import { Pill } from "../ui/Pill";
import { EventBadge } from "../ui/EventBadge";
import { StepLane } from "../ui/StepLane";

import { Box, IconButton, Stack, Typography } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

export function makeDefaultColumns(): DrawTableColumn[] {
  const columns: DrawTableColumn[] = [
    {
      id: "count",
      widthKey: "count",
      render: (r, ctx) => {
        return (
          <Stack direction="row" spacing={1} alignItems="center">
            {ctx.countCell.kind === "toggle" ? (
              <IconButton
                size="small"
                onClick={ctx.countCell.onToggle}
                aria-label={ctx.countCell.ariaLabel || "toggle"}
              >
                {ctx.countCell.open ? (
                  <KeyboardArrowUpIcon />
                ) : (
                  <KeyboardArrowDownIcon />
                )}
              </IconButton>
            ) : (
              <Box sx={{ width: 34 }} />
            )}

            <Typography variant="body2" fontWeight={900}>
              {r.countText}
            </Typography>
          </Stack>
        );
      },
    },
    // {
    //   id: "step",
    //   widthKey: "step",
    //   render: (r) => (
    //     <Pill
    //       text={r.stepText}
    //       tone={r.stepText !== "-" ? "strong" : "normal"}
    //     />
    //   ),
    // },
    {
      id: "action",
      widthKey: "action",
      render: (r) => (
        <Pill
          text={r.actionText}
          tone={r.isTen && r.isHeader ? "strong" : "normal"}
        />
      ),
    },
    {
      id: "event",
      widthKey: "event",
      render: (r, ctx) => {
        const evKey = r.eventName || r.eventValue;
        return (
          <EventBadge
            evKey={evKey}
            colorOf={ctx.eventColorOf}
            tintOf={ctx.eventTintOf}
          />
        );
      },
    },
    {
      id: "A",
      widthKey: "A",
      render: (r, ctx) => {
        const isEllipsis = r.countText === "⋯";
        return (
          <StepLane
            lane="A"
            text={r.A}
            status={r.statusA}
            isTarget={!isEllipsis && r.isTargetA}
            hasNext={ctx.hasNextInBlock}
            isEllipsis={isEllipsis}
          />
        );
      },
    },
    {
      id: "B",
      widthKey: "B",
      render: (r, ctx) => {
        const isEllipsis = r.countText === "⋯";
        return (
          <StepLane
            lane="B"
            text={r.B}
            status={r.statusB}
            isTarget={!isEllipsis && r.isTargetB}
            hasNext={ctx.hasNextInBlock}
            isEllipsis={isEllipsis}
          />
        );
      },
    },
  ];

  return columns;
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
