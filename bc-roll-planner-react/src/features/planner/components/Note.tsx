import { DATA_SOURCES } from "@/config/dataSources";
import { cn } from "@/lib/utils";

export function DisclaimerNote({
  className,
}: {
  className?: string;
}) {
  return (
    <p className={cn("text-sm leading-6 text-muted-foreground", className)}>
      ※ 本工具資料主要取自 {DATA_SOURCES.crawler.name}（
      <a
        href={DATA_SOURCES.crawler.url}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:text-primary/80"
      >
        {DATA_SOURCES.crawler.url}
      </a>
      ），可能因來源變動而不完整或延遲，規劃結果需自行驗證。
    </p>
  );
}
