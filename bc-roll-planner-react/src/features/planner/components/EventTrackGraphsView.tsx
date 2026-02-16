// src/features/planner/ui/EventTrackGraphsView.tsx
import React, { useMemo, useState } from "react";
import type { PlanResult } from "@/features/planner/logic/core";
import type { TrackGraph } from "@/types/models";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  STATUS_STYLE,
  type StatusKey,
  posTrackFromPosId,
  safeGetNormalCatName,
  // eventColor,
  // eventTint,
  makeEventColorPicker,
} from "../logic/view-model";

type Marker = {
  stepIndex: number; // 0-based
  within: number; // 1..N
  method: "single" | "ten";
  used: "normal" | "switch_track" | "guaranteed";
  isTarget: boolean;
  isGuaranteed: boolean;
};

function TrackLaneCell(props: {
  lane: "A" | "B";
  text: string;
  status: StatusKey;
  isTarget: boolean;
  markers: Marker[];
  hasNext: boolean;
}) {
  const { lane, text, status, isTarget, markers, hasNext } = props;
  const laneW = 26;
  const nodeSize = 14;

  const visibleMarkers = markers.slice(0, 2);
  const extra = markers.length - visibleMarkers.length;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
      <Box
        sx={{
          position: "relative",
          width: laneW,
          flex: `0 0 ${laneW}px`,
          height: 30,
          display: "grid",
          placeItems: "center",
          overflow: "visible",
        }}
      >
        {hasNext && (
          <Box
            sx={{
              position: "absolute",
              left: "50%",
              top: 18,
              bottom: -10,
              width: 2,
              transform: "translateX(-50%)",
              bgcolor: "divider",
              borderRadius: 999,
            }}
          />
        )}

        <Box
          sx={{
            width: nodeSize,
            height: nodeSize,
            borderRadius: 999,
            bgcolor: STATUS_STYLE[status].node,
            border: "2px solid",
            borderColor: "divider",
            zIndex: 1,
          }}
        />
      </Box>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box
          sx={{
            px: 1,
            py: 0.55,
            borderRadius: 999,
            bgcolor:
              status === "normal" ? "action.hover" : STATUS_STYLE[status].bg,
            border: "1px solid",
            borderColor: status === "normal" ? "divider" : "transparent",
            minWidth: 0,
          }}
          title={text}
        >
          <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
            {text}
          </Typography>
        </Box>

        {!!markers.length && (
          <Stack
            direction="row"
            spacing={0.5}
            flexWrap="wrap"
            useFlexGap
            sx={{ mt: 0.5 }}
          >
            {visibleMarkers.map((m, idx) => {
              const badge = m.isGuaranteed
                ? "G"
                : m.method === "ten"
                ? `10-${m.within}`
                : "S";
              return (
                <Chip
                  key={`${lane}-${idx}-${m.stepIndex}-${m.within}`}
                  size="small"
                  variant="outlined"
                  label={`step${m.stepIndex + 1} ${badge}`}
                  sx={{
                    height: 20,
                    "& .MuiChip-label": { px: 0.75, fontSize: 11 },
                  }}
                />
              );
            })}
            {extra > 0 && (
              <Chip
                size="small"
                variant="outlined"
                label={`+${extra}`}
                sx={{
                  height: 20,
                  "& .MuiChip-label": { px: 0.75, fontSize: 11 },
                }}
              />
            )}
          </Stack>
        )}
      </Box>
    </Box>
  );
}

function bestStatus(markers: Marker[]): StatusKey {
  if (!markers.length) return "normal";
  // if (markers.some((m) => m.isTarget)) return "target";
  if (markers.some((m) => m.isGuaranteed)) return "guaranteed";
  return "hit";
}

function hasTarget(markers: Marker[]): boolean {
  return markers.some((m) => m.isTarget);
}

export function EventTrackGraphsView(props: {
  result: PlanResult;
  graphsByEvent: Record<string, TrackGraph>;
  targetCatIds: number[];
}) {
  const { result, graphsByEvent, targetCatIds } = props;
  const [onlyTouched, setOnlyTouched] = useState(false);

  const targetSet = useMemo(() => new Set(targetCatIds), [targetCatIds]);

  const markersByEventPos = useMemo(() => {
    const map = new Map<string, Marker[]>();
    const plan = (result.plan || []) as any[];

    for (let si = 0; si < plan.length; si++) {
      const st = plan[si];
      const ev = String(st.event_value || "");
      const method = st.method as "single" | "ten";
      const draws = Array.isArray(st.draws) ? st.draws : [];

      for (let di = 0; di < draws.length; di++) {
        const d = draws[di];
        const from = posTrackFromPosId(String(d.from_pos_id || ""));
        if (!from.ok) continue;

        const isGuaranteed = d.used === "guaranteed";
        const isTarget = d.cat_id != null && targetSet.has(d.cat_id);

        const key = `${ev}|${from.pos}${from.track}`;
        const arr = map.get(key) ?? [];
        arr.push({
          stepIndex: si,
          within: di + 1,
          method,
          used: d.used,
          isTarget,
          isGuaranteed,
        });
        map.set(key, arr);
      }
    }

    return map;
  }, [result, targetSet]);

  const eventEntries = useMemo(() => {
    return Object.entries(graphsByEvent).sort((a, b) => {
      const an = a[1]?.event?.name || a[0];
      const bn = b[1]?.event?.name || b[0];
      return an.localeCompare(bn);
    });
  }, [graphsByEvent]);

  const eventKeysInOrder = useMemo(
    () => eventEntries.map(([ev]) => ev),
    [eventEntries]
  );

  const eventPicker = useMemo(
    () => makeEventColorPicker(eventKeysInOrder),
    [eventKeysInOrder]
  );

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Typography fontWeight={900}>
            TrackGraph 視覺化（每個 Event）
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={onlyTouched}
                onChange={(e) => setOnlyTouched(e.target.checked)}
              />
            }
            label={<Typography variant="body2">只顯示被用到的位置</Typography>}
          />
        </Stack>

        <Divider />

        <Stack spacing={1}>
          {eventEntries.map(([ev, g]) => {
            const name = g?.event?.name || ev;
            const count = g?.count ?? 0;

            return (
              <Accordion key={ev} defaultExpanded={eventEntries.length <= 2}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      px: 1,
                      py: 0.6,
                      borderRadius: 999,
                      border: "1px solid",
                      // borderColor: eventPicker.colorOf(name),
                      // bgcolor: eventPicker.tintOf(name),
                      borderColor: eventPicker.colorOf(ev),
                      bgcolor: eventPicker.tintOf(ev),

                      minWidth: 0,
                      maxWidth: "100%",
                    }}
                    title={name}
                  >
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        // bgcolor: eventColor(name),
                        bgcolor: eventPicker.colorOf(ev),
                        flex: "0 0 auto",
                      }}
                    />
                    <Typography fontWeight={900} noWrap sx={{ minWidth: 0 }}>
                      {name}
                    </Typography>
                    <Chip
                      size="small"
                      label={`count=${count}`}
                      variant="outlined"
                      sx={{ ml: 1 }}
                    />
                  </Box>
                </AccordionSummary>

                <AccordionDetails sx={{ pt: 0 }}>
                  <TableContainer
                    sx={{
                      maxHeight: 520,
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 2,
                    }}
                  >
                    <Table
                      size="small"
                      stickyHeader
                      sx={{ tableLayout: "fixed", minWidth: 760 }}
                    >
                      <TableHead>
                        <TableRow>
                          <TableCell width={72} sx={{ fontWeight: 900 }}>
                            pos
                          </TableCell>
                          <TableCell sx={{ fontWeight: 900 }}>A</TableCell>
                          <TableCell sx={{ fontWeight: 900 }}>B</TableCell>
                        </TableRow>
                      </TableHead>

                      <TableBody>
                        {Array.from({ length: count }, (_, i) => i + 1)
                          .filter((pos) => {
                            if (!onlyTouched) return true;
                            const aKey = `${ev}|${pos}A`;
                            const bKey = `${ev}|${pos}B`;
                            return (
                              (markersByEventPos.get(aKey)?.length ?? 0) > 0 ||
                              (markersByEventPos.get(bKey)?.length ?? 0) > 0
                            );
                          })
                          .map((pos, idx, arr) => {
                            const aKey = `${ev}|${pos}A`;
                            const bKey = `${ev}|${pos}B`;

                            const aMarkers = markersByEventPos.get(aKey) ?? [];
                            const bMarkers = markersByEventPos.get(bKey) ?? [];

                            const aText = safeGetNormalCatName(g, `${pos}A`);
                            const bText = safeGetNormalCatName(g, `${pos}B`);

                            const hasNext = idx < arr.length - 1;

                            return (
                              <TableRow key={`${ev}-${pos}`} hover>
                                <TableCell sx={{ whiteSpace: "nowrap" }}>
                                  <Typography variant="body2" fontWeight={900}>
                                    {pos}
                                  </Typography>
                                </TableCell>

                                <TableCell>
                                  <TrackLaneCell
                                    lane="A"
                                    text={aText}
                                    status={bestStatus(aMarkers)}
                                    isTarget={hasTarget(aMarkers)}
                                    markers={aMarkers}
                                    hasNext={hasNext}
                                  />
                                </TableCell>

                                <TableCell>
                                  <TrackLaneCell
                                    lane="B"
                                    text={bText}
                                    status={bestStatus(bMarkers)}
                                    isTarget={hasTarget(bMarkers)}
                                    markers={bMarkers}
                                    hasNext={hasNext}
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 1 }}
                  >
                    顏色：黃=抽到、綠框=目標、粉紫=保底。Chip：stepX
                    S=單抽、10-n=10連第 n 抽、G=保底。
                  </Typography>
                </AccordionDetails>
              </Accordion>
            );
          })}

          {!eventEntries.length && (
            <Typography variant="body2" color="text.secondary">
              （目前沒有 graphs 可顯示）
            </Typography>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
