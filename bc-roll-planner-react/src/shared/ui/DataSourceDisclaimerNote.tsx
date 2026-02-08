import { Alert, Link, Typography } from "@mui/material";
import { DATA_SOURCES } from "@/shared/config/dataSources";

export function DataSourceDisclaimerNote() {
  return (
    <Alert severity="info" variant="outlined">
      <Typography variant="body2" color="text.secondary">
        本工具資料主要取自 {DATA_SOURCES.crawler.name}（
        <Link href={DATA_SOURCES.crawler.url} target="_blank" rel="noreferrer">
          {DATA_SOURCES.crawler.url}
        </Link>
        ），可能因來源變動而不完整或延遲，規劃結果需自行驗證。
      </Typography>
    </Alert>
  );
}
