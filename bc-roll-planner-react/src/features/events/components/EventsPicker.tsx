import {
  startTransition,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import { ChevronDown } from "lucide-react";
import type { Event } from "@/types/models";
import { getEventDisplayLines } from "@/utils/event-display";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type LoadState = "idle" | "loading" | "ok" | "error";

function EventOption({
  event,
  checked,
  isPrimary,
  onToggle,
  onPrimary,
}: {
  event: Event;
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
        "flex w-full items-start justify-between gap-3 rounded-2xl px-3 py-3 text-left transition-colors",
        checked ? "bg-primary/5" : "hover:bg-muted/35",
      )}
      title={titleText}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-medium text-foreground">{nameText}</div>
          {isPrimary ? <Badge variant="default">主要</Badge> : null}
        </div>
        <div className="text-xs text-muted-foreground">{dateText}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {checked && !isPrimary ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(eventObject) => {
              eventObject.stopPropagation();
              onPrimary();
            }}
            onKeyDown={(eventObject) => {
              if (eventObject.key === "Enter" || eventObject.key === " ") {
                eventObject.preventDefault();
                eventObject.stopPropagation();
                onPrimary();
              }
            }}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            設為主要
          </span>
        ) : null}
        <div
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-full border text-[11px] font-bold",
            checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-transparent",
          )}
        >
          ✓
        </div>
      </div>
    </button>
  );
}

function EventGroupSection({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border/55 pt-4 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 py-1 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <Badge variant="muted">{count}</Badge>
        </div>
        <ChevronDown
          className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? <div className="subtle-scrollbar mt-3 max-h-[24rem] space-y-1 overflow-y-auto pr-1">{children}</div> : null}
    </section>
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
  const [panelOpen, setPanelOpen] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
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
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-foreground">Event</div>
        <div className="flex items-center gap-2">
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
          <Button
            variant={panelOpen ? "outline" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={() =>
              startTransition(() => setPanelOpen((current) => !current))
            }
          >
            {panelOpen ? "收合" : "展開"}
            <ChevronDown
              className={cn("size-4 transition-transform", panelOpen && "rotate-180")}
            />
          </Button>
        </div>
      </div>

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
        <div className="text-sm text-muted-foreground">尚未選擇 event</div>
      )}

      <Input
        name="event-search"
        autoComplete="off"
        value={query}
        onChange={(event) => startTransition(() => setQuery(event.target.value))}
        placeholder="搜尋卡池名稱或日期"
      />

      {panelOpen ? (
        <div className="space-y-4 border-t border-border/55 pt-4">
          {loadState === "loading" ? <Alert variant="info">正在載入 events…</Alert> : null}
          {loadState === "error" ? <Alert variant="error">{error}</Alert> : null}

          <EventGroupSection
            label="Upcoming"
            count={filteredUpcoming.length}
            open={upcomingOpen}
            onToggle={() =>
              startTransition(() => setUpcomingOpen((current) => !current))
            }
          >
            {filteredUpcoming.length ? (
              filteredUpcoming.map((event) => (
                <EventOption
                  key={event.value}
                  event={event}
                  checked={selectedSet.has(event.value)}
                  isPrimary={primaryValue === event.value}
                  onToggle={() => toggleEvent(event.value)}
                  onPrimary={() => onPrimaryChange(event.value)}
                />
              ))
            ) : (
              <div className="rounded-2xl bg-muted/35 px-4 py-6 text-sm text-muted-foreground">
                沒有符合搜尋條件的 upcoming events
              </div>
            )}
          </EventGroupSection>

          <EventGroupSection
            label="Past"
            count={filteredPast.length}
            open={pastOpen}
            onToggle={() =>
              startTransition(() => setPastOpen((current) => !current))
            }
          >
            {filteredPast.length ? (
              filteredPast.map((event) => (
                <EventOption
                  key={event.value}
                  event={event}
                  checked={selectedSet.has(event.value)}
                  isPrimary={primaryValue === event.value}
                  onToggle={() => toggleEvent(event.value)}
                  onPrimary={() => onPrimaryChange(event.value)}
                />
              ))
            ) : (
              <div className="rounded-2xl bg-muted/35 px-4 py-6 text-sm text-muted-foreground">
                沒有符合搜尋條件的 past events
              </div>
            )}
          </EventGroupSection>
        </div>
      ) : null}
    </section>
  );
}
