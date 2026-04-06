import type { Event } from "@/types/models";

type EventDisplayInput = Pick<
  Event,
  "name" | "raw_name" | "start_date" | "end_date"
>;

export function formatEventDateText(event: EventDisplayInput): string {
  const start = String(event.start_date || "").trim();
  const end = String(event.end_date || "").trim();

  if (start && end) return start === end ? start : `${start} ~ ${end}`;
  if (start) return start;
  if (end) return end;
  return "日期未提供";
}

export function getEventDisplayLines(event: EventDisplayInput): {
  dateText: string;
  nameText: string;
  titleText: string;
} {
  const dateText = formatEventDateText(event);
  const nameText = String(event.name || "").trim() || "-";

  return {
    dateText,
    nameText,
    titleText: `${dateText}\n${nameText}`,
  };
}
