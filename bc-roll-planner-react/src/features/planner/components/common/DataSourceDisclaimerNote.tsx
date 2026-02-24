import { Link, Typography } from "@mui/material";
import { DATA_SOURCES } from "@/config/dataSources";

type DataSourceDisclaimerNoteProps = {
  /** 文字顏色（可用 MUI token 或 CSS 色碼） */
  textColor?: string;
  /** 連結顏色（可用 MUI token 或 CSS 色碼） */
  linkColor?: string;
  /** caption 字體大小微調 */
  fontSize?: number | string;
};

export function DataSourceDisclaimerNote({
  textColor = "text.secondary",
  linkColor = "primary.main",
  fontSize,
}: DataSourceDisclaimerNoteProps) {
  return (
    <Typography
      variant="caption"
      sx={{
        display: "block",
        color: textColor,
        fontSize,
      }}
    >
      ※ 本工具資料主要取自 {DATA_SOURCES.crawler.name}（
      <Link
        href={DATA_SOURCES.crawler.url}
        target="_blank"
        rel="noreferrer"
        sx={{
          color: linkColor,
          textDecorationColor: linkColor,
          "&:hover": { opacity: 0.85 },
        }}
      >
        {DATA_SOURCES.crawler.url}
      </Link>
      ），可能因來源變動而不完整或延遲，規劃結果需自行驗證。
    </Typography>
  );
}
