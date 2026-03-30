import {
  startTransition,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import { ChevronDown, Search } from "lucide-react";
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
  onToggle,
}: {
  event: Event;
  checked: boolean;
  onToggle: () => void;
}) {
  const { dateText, nameText, titleText } = getEventDisplayLines(event);

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-start gap-2.5 px-2.5 py-2 text-left transition-colors",
        checked ? "bg-primary/5" : "hover:bg-muted/35",
      )}
      title={titleText}
    >
      <div
        className={cn(
          "mt-0.5 inline-flex size-[18px] shrink-0 items-center justify-center rounded-md border text-[10px] font-bold",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border text-transparent",
        )}
      >
        ✓
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="text-sm font-medium text-foreground">{nameText}</div>
        <div className="text-xs text-muted-foreground">{dateText}</div>
      </div>
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
}) {
  const {
    loadState,
    error,
    upcomingEvents,
    pastEvents,
    value,
    onChange,
  } = props;

  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
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

  const selectedEvents = value
    .map((eventValue) => findEvent(eventValue))
    .filter(Boolean) as Event[];

  const toggleEvent = (eventValue: string) => {
    if (selectedSet.has(eventValue)) {
      onChange(value.filter((entry) => entry !== eventValue));
      return;
    }
    onChange([...value, eventValue]);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-foreground">卡池</div>
          {value.length > 0 && <Badge variant="muted">{value.length}</Badge>}
        </div>
        <div className="flex items-center gap-1.5">
          {value.length ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange([])}
            >
              清空
            </Button>
          ) : null}
          <Button
            variant={panelOpen ? "outline" : "ghost"}
            size="sm"
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

      {selectedEvents.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedEvents.map((event) => (
            <Badge
              key={event.value}
              variant="outline"
            >
              {event.name}
            </Badge>
          ))}
        </div>
      )}

      {panelOpen ? (
        <div className="space-y-3 border-t border-border/45 pt-3">
          <div className="relative w-full sm:w-[320px] sm:ml-auto">
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
          {loadState === "loading" ? <Alert variant="info">正在載入卡池…</Alert> : null}
          {loadState === "error" ? <Alert variant="error">{error}</Alert> : null}

          <div className="subtle-scrollbar max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {filteredUpcoming.length > 0 && (
              <section>
                <div className="flex items-center gap-2 py-1">
                  <span className="text-sm font-semibold text-foreground">Upcoming</span>
                  <Badge variant="muted">{filteredUpcoming.length}</Badge>
                </div>
                <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {filteredUpcoming.map((event) => (
                    <EventOption
                      key={event.value}
                      event={event}
                      checked={selectedSet.has(event.value)}
                      onToggle={() => toggleEvent(event.value)}
                    />
                  ))}
                </div>
              </section>
            )}

            {filteredPast.length > 0 && (
              <section className={filteredUpcoming.length > 0 ? "border-t border-border/45 pt-3" : ""}>
                <div className="flex items-center gap-2 py-1">
                  <span className="text-sm font-semibold text-foreground">Past</span>
                  <Badge variant="muted">{filteredPast.length}</Badge>
                </div>
                <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {filteredPast.map((event) => (
                    <EventOption
                      key={event.value}
                      event={event}
                      checked={selectedSet.has(event.value)}
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
      ) : null}
    </section>
  );
}
