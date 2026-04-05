import { Info, AlertTriangle } from "lucide-react";
import { DATA_SOURCES } from "@/config/dataSources";
import { cn } from "@/lib/utils";

// ── 公告 / 注意事項 ──────────────────────────────────────────────────────────
// 新增公告在這裡，最新的放最上面。
const ANNOUNCEMENTS = ["破壞者系列卡池目前僅支援單抽，特殊抽卡機制尚未實作。"];

export function NotesBlock({ className }: { className?: string }) {
  return (
    <ul
      className={cn(
        "space-y-1.5 rounded-md py-2 text-sm text-muted-foreground",
        className,
      )}
    >
      <li className="flex items-start gap-2">
        {/* <Info className="mt-0.5 size-3.5 shrink-0 opacity-60" /> */}
        <span>
          本工具資料主要取自 {DATA_SOURCES.crawler.name}（
          <a
            href={DATA_SOURCES.crawler.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:text-primary/80"
          >
            {DATA_SOURCES.crawler.url}
          </a>
          ），可能因來源變動而不完整或延遲，規劃結果需自行驗證。
        </span>
      </li>
      {ANNOUNCEMENTS.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 opacity-75" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
