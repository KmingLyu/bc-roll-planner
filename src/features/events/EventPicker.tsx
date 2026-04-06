import {
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import {
  Search,
} from "lucide-react";
import type { Event } from "@/types/models";
import {
  formatEventDateText,
  getEventDisplayLines,
} from "@/utils/event-display";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { cn } from "@/lib/utils";

type LoadState = "idle" | "loading" | "ok" | "error";

import { describeSelectionCapacity } from "@/lib/selection";

function EventOption({
  event,
  checked,
  disabled = false,
  onToggle,
}: {
  event: Event;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const { dateText, nameText, titleText } = getEventDisplayLines(event);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex w-full items-start rounded-lg border px-2 py-2 text-left transition-colors disabled:cursor-not-allowed",
        checked
          ? "border-primary/45 bg-primary/[0.06] shadow-[inset_0_0_0_1px_rgba(59,130,246,0.12)]"
          : disabled
            ? "border-transparent opacity-45"
            : "border-transparent hover:border-border/60 hover:bg-muted/20",
      )}
      title={titleText}
      aria-disabled={disabled}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div
          className={cn(
            "text-sm font-semibold leading-5 text-foreground",
            checked && "text-foreground",
          )}
        >
          {nameText}
        </div>
        <div className="text-xs text-muted-foreground">{dateText}</div>
      </div>
    </button>
  );
}

function SelectedEventSummaryItem(props: {
  nameText: string;
  dateText: string;
  titleText: string;
}) {
  const { nameText, dateText, titleText } = props;
  return (
    <div
      className="py-2.5 first:pt-0 last:pb-0"
      title={titleText}
    >
      <div className="text-sm font-semibold leading-5 text-foreground">
        {nameText}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {dateText}
      </div>
    </div>
  );
}

export function EventPicker(props: {
  loadState: LoadState;
  error: string;
  upcomingEvents: Event[];
  pastEvents: Event[];
  value: string[];
  maxSelection: number;
  onChange: (next: string[]) => void;
}) {
  const {
    loadState,
    error,
    upcomingEvents,
    pastEvents,
    value,
    maxSelection,
    onChange,
  } = props;

  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const selectedSet = useMemo(() => new Set(value), [value]);

  const findEvent = (eventValue: string) =>
    upcomingEvents.find((event) => event.value === eventValue) ??
    pastEvents.find((event) => event.value === eventValue);

  const filterEvents = (events: Event[]) =>
    events.filter((event) => {
      if (!normalizedQuery) return true;
      return (
        event.name.toLowerCase().includes(normalizedQuery) ||
        event.raw_name.toLowerCase().includes(normalizedQuery) ||
        String(event.start_date ?? "").toLowerCase().includes(normalizedQuery) ||
        String(event.end_date ?? "").toLowerCase().includes(normalizedQuery)
      );
    });

  const filteredUpcoming = useMemo(
    () => filterEvents(upcomingEvents),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [normalizedQuery, upcomingEvents],
  );
  const filteredPast = useMemo(
    () => filterEvents(pastEvents),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [normalizedQuery, pastEvents],
  );

  const selectedEventSummaries = value.map((eventValue) => {
    const event = findEvent(eventValue);
    if (!event) {
      return {
        id: eventValue,
        nameText: eventValue,
        dateText: "卡池資料載入中",
        titleText: eventValue,
      };
    }

    const { nameText, titleText } = getEventDisplayLines(event);
    return {
      id: event.value,
      nameText,
      dateText: formatEventDateText(event),
      titleText,
    };
  });
  const visibleSelectedEvents = selectedEventSummaries.slice(0, maxSelection);
  const hiddenSelectedEventCount = Math.max(0, selectedEventSummaries.length - visibleSelectedEvents.length);
  const atSelectionLimit = value.length >= maxSelection;
  const selectionSummary = describeSelectionCapacity({
    count: value.length,
    limit: maxSelection,
    unit: "個卡池",
  });

  const toggleEvent = (eventValue: string) => {
    if (selectedSet.has(eventValue)) {
      onChange(value.filter((entry) => entry !== eventValue));
      return;
    }
    if (value.length >= maxSelection) {
      return;
    }
    onChange([...value, eventValue]);
  };

  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-foreground">選擇卡池</div>
          <Badge variant={atSelectionLimit ? "warning" : "muted"}>
            {value.length}/{maxSelection}
          </Badge>
          {value.length ? (
            <Button
              variant="ghost"
              size="sm"
              className="ml-1 h-auto rounded-none border-l border-border/55 px-0 pl-3 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
              onClick={() => onChange([])}
            >
              清空
            </Button>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="group block w-full rounded-2xl border border-border/55 bg-background px-4 py-3 text-left transition-colors hover:border-border hover:bg-muted/[0.04] active:bg-muted/[0.08]"
      >
        {selectedEventSummaries.length > 0 ? (
          <div className="divide-y divide-border/40">
            {visibleSelectedEvents.map((event) => (
              <SelectedEventSummaryItem
                key={event.id}
                nameText={event.nameText}
                dateText={event.dateText}
                titleText={event.titleText}
              />
            ))}
            {hiddenSelectedEventCount > 0 ? (
              <div className="pt-2 text-sm font-medium text-muted-foreground">
                +{hiddenSelectedEventCount} 個已選卡池
              </div>
            ) : null}
          </div>
        ) : (
          <div className="py-2 text-sm text-muted-foreground">
            點擊選擇卡池
          </div>
        )}
      </button>
      <div
        className={cn(
          "px-1 text-xs",
          atSelectionLimit ? "font-medium text-warning" : "text-muted-foreground",
        )}
      >
        {selectionSummary}
      </div>

      <BottomSheet
        open={sheetOpen}
        onOpenChange={(nextOpen) => {
          setSheetOpen(nextOpen);
          if (!nextOpen) setQuery("");
        }}
        title={`選擇卡池 (${value.length}/${maxSelection})`}
        toolbar={(
          <div className="flex items-center gap-4">
            <div className="w-20 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange([])}
                className={cn(
                  "h-auto w-full shrink-0 justify-end px-0 pr-2 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground",
                  value.length > 0 ? "visible" : "invisible",
                )}
                tabIndex={value.length > 0 ? 0 : -1}
                aria-hidden={value.length > 0 ? undefined : true}
              >
                清空
              </Button>
            </div>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="event-search"
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜尋卡池名稱或日期"
                className="workspace-search pl-11"
              />
            </div>
          </div>
        )}
      >
        <div className="space-y-3">
          {atSelectionLimit ? (
            <Alert variant="warning">
              已選滿 {maxSelection} 個卡池，先取消既有卡池才能再新增。
            </Alert>
          ) : (
            <div className="px-1 text-xs text-muted-foreground">
              已選 {value.length} / {maxSelection} 個卡池，還可再選 {maxSelection - value.length} 個。
            </div>
          )}
          {loadState === "loading" ? <Alert variant="info">正在載入卡池…</Alert> : null}
          {loadState === "error" ? <Alert variant="error">{error}</Alert> : null}

          <div className="space-y-3">
            {filteredUpcoming.length > 0 && (
              <section>
                <div className="sticky top-0 z-10 -mx-5 mb-1 flex items-center gap-2 border-b border-border/45 bg-card/95 px-5 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/85">
                  <span className="text-sm font-semibold text-foreground">Upcoming</span>
                  <Badge variant="muted">{filteredUpcoming.length}</Badge>
                </div>
                <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {filteredUpcoming.map((event) => (
                    <EventOption
                      key={event.value}
                      event={event}
                      checked={selectedSet.has(event.value)}
                      disabled={atSelectionLimit && !selectedSet.has(event.value)}
                      onToggle={() => toggleEvent(event.value)}
                    />
                  ))}
                </div>
              </section>
            )}

            {filteredPast.length > 0 && (
              <section className={filteredUpcoming.length > 0 ? "border-t border-border/45 pt-3" : ""}>
                <div className="sticky top-0 z-10 -mx-5 mb-1 flex items-center gap-2 border-b border-border/45 bg-card/95 px-5 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/85">
                  <span className="text-sm font-semibold text-foreground">Past</span>
                  <Badge variant="muted">{filteredPast.length}</Badge>
                </div>
                <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {filteredPast.map((event) => (
                    <EventOption
                      key={event.value}
                      event={event}
                      checked={selectedSet.has(event.value)}
                      disabled={atSelectionLimit && !selectedSet.has(event.value)}
                      onToggle={() => toggleEvent(event.value)}
                    />
                  ))}
                </div>
              </section>
            )}

            {!filteredUpcoming.length && !filteredPast.length && (
              <div className="bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                沒有符合搜尋條件的卡池
              </div>
            )}
          </div>
        </div>
      </BottomSheet>
    </section>
  );
}
