import { startTransition, useDeferredValue, useMemo, useState } from "react";
import type { Event } from "@/types/models";
import { getEventDisplayLines } from "@/utils/event-display";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type LoadState = "idle" | "loading" | "ok" | "error";
type EvKind = "upcoming" | "past";

function EventOption({
  event,
  kind,
  checked,
  isPrimary,
  onToggle,
  onPrimary,
}: {
  event: Event;
  kind: EvKind;
  checked: boolean;
  isPrimary: boolean;
  onToggle: () => void;
  onPrimary: () => void;
}) {
  const { dateText, nameText, titleText } = getEventDisplayLines(event);

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full flex-col gap-3 rounded-3xl border px-4 py-4 text-left transition-[transform,background-color,border-color,box-shadow]",
        checked
          ? "border-primary/40 bg-primary/5 shadow-sm"
          : "border-border bg-background hover:border-primary/30 hover:bg-accent/30",
      )}
      title={titleText}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {kind === "upcoming" ? "Upcoming" : "Past"}
          </div>
          <div className="mt-1 text-sm font-semibold text-foreground">{nameText}</div>
          <div className="mt-1 text-xs text-muted-foreground">{dateText}</div>
        </div>
        <div
          className={cn(
            "mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
            checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-transparent",
          )}
        >
          ✓
        </div>
      </div>

      {checked ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isPrimary ? "default" : "muted"}>
            {isPrimary ? "主要 event" : "已選取"}
          </Badge>
          {!isPrimary ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 rounded-full px-3"
              onClick={(eventObject) => {
                eventObject.stopPropagation();
                onPrimary();
              }}
            >
              設為主要
            </Button>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}

export function EventsPicker(props: {
  loadState: LoadState;
  error: string;
  upcomingEvents: Event[];
  pastEvents: Event[];
  value: string[];
  onChange: (next: string[]) => void;
  primaryValue: string;
  onPrimaryChange: (v: string) => void;
}) {
  const {
    loadState,
    error,
    upcomingEvents,
    pastEvents,
    value,
    onChange,
    primaryValue,
    onPrimaryChange,
  } = props;

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const selectedSet = useMemo(() => new Set(value), [value]);

  const findEvent = (eventValue: string) =>
    upcomingEvents.find((event) => event.value === eventValue) ??
    pastEvents.find((event) => event.value === eventValue);

  const filteredUpcoming = useMemo(
    () =>
      upcomingEvents.filter((event) => {
        if (!normalizedQuery) return true;
        return (
          event.name.toLowerCase().includes(normalizedQuery) ||
          event.raw_name.toLowerCase().includes(normalizedQuery) ||
          String(event.start_date ?? "").toLowerCase().includes(normalizedQuery) ||
          String(event.end_date ?? "").toLowerCase().includes(normalizedQuery)
        );
      }),
    [normalizedQuery, upcomingEvents],
  );
  const filteredPast = useMemo(
    () =>
      pastEvents.filter((event) => {
        if (!normalizedQuery) return true;
        return (
          event.name.toLowerCase().includes(normalizedQuery) ||
          event.raw_name.toLowerCase().includes(normalizedQuery) ||
          String(event.start_date ?? "").toLowerCase().includes(normalizedQuery) ||
          String(event.end_date ?? "").toLowerCase().includes(normalizedQuery)
        );
      }),
    [normalizedQuery, pastEvents],
  );

  const selectedEvents = value
    .map((eventValue) => findEvent(eventValue))
    .filter(Boolean) as Event[];

  const toggleEvent = (eventValue: string) => {
    if (selectedSet.has(eventValue)) {
      const next = value.filter((entry) => entry !== eventValue);
      onChange(next);
      if (primaryValue === eventValue) {
        onPrimaryChange(next[0] ?? "");
      }
      return;
    }

    const next = [...value, eventValue];
    onChange(next);
    if (!primaryValue) {
      onPrimaryChange(eventValue);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">卡池選擇</div>
            <div className="text-sm text-muted-foreground">
              可多選。規劃時會一起抓取對應 TrackGraph。
            </div>
          </div>
          {value.length ? (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={() => {
                onChange([]);
                onPrimaryChange("");
              }}
            >
              清空
            </Button>
          ) : null}
        </div>

        <Input
          name="event-search"
          autoComplete="off"
          value={query}
          onChange={(event) =>
            startTransition(() => setQuery(event.target.value))
          }
          placeholder="搜尋卡池名稱或日期"
        />

        {selectedEvents.length ? (
          <div className="flex flex-wrap gap-2">
            {selectedEvents.map((event) => (
              <Badge
                key={event.value}
                variant={primaryValue === event.value ? "default" : "outline"}
              >
                {event.name}
              </Badge>
            ))}
          </div>
        ) : (
          <Alert variant="info">尚未選擇任何 event。</Alert>
        )}
      </div>

      {loadState === "loading" ? <Alert variant="info">正在載入 events…</Alert> : null}
      {loadState === "error" ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="section-surface p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-foreground">
              Upcoming Events
            </div>
            <Badge variant="muted">{filteredUpcoming.length}</Badge>
          </div>
          <div className="subtle-scrollbar max-h-[26rem] space-y-3 overflow-y-auto pr-1">
            {filteredUpcoming.length ? (
              filteredUpcoming.map((event) => (
                <EventOption
                  key={event.value}
                  event={event}
                  kind="upcoming"
                  checked={selectedSet.has(event.value)}
                  isPrimary={primaryValue === event.value}
                  onToggle={() => toggleEvent(event.value)}
                  onPrimary={() => onPrimaryChange(event.value)}
                />
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                沒有符合搜尋條件的 upcoming events
              </div>
            )}
          </div>
        </section>

        <section className="section-surface p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-foreground">Past Events</div>
            <Badge variant="muted">{filteredPast.length}</Badge>
          </div>
          <div className="subtle-scrollbar max-h-[26rem] space-y-3 overflow-y-auto pr-1">
            {filteredPast.length ? (
              filteredPast.map((event) => (
                <EventOption
                  key={event.value}
                  event={event}
                  kind="past"
                  checked={selectedSet.has(event.value)}
                  isPrimary={primaryValue === event.value}
                  onToggle={() => toggleEvent(event.value)}
                  onPrimary={() => onPrimaryChange(event.value)}
                />
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                沒有符合搜尋條件的 past events
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
