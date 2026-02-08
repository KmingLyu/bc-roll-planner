// src/pages/HomePage.tsx
import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  Link,
  Stack,
  Typography,
} from "@mui/material";

import PlannerPage from "@/pages/PlannerPage";
import { DATA_SOURCES } from "@/shared/config/dataSources";

export default function HomePage() {
  const [started, setStarted] = useState(false);

  if (started) return <PlannerPage />;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={2.5}>
        <Stack spacing={0.5}>
          <Typography variant="h4" fontWeight={900}>
            🐾 貓咪大戰爭抽卡規劃（測試版）
          </Typography>
          <Typography color="text.secondary">
            這個工具用來協助你在已知 seed / count
            的情況下，選定卡池與目標貓，並用 planner
            模擬與規劃資源使用，產出建議抽法與步驟表。
          </Typography>
        </Stack>

        <Alert severity="warning" variant="outlined">
          <Typography fontWeight={800} sx={{ mb: 0.5 }}>
            免責聲明（請務必閱讀）
          </Typography>
          <Typography variant="body2" color="text.secondary">
            本工具的卡池/活動/軌道等資訊係基於爬蟲抓取之資料來源，可能因資料延遲、網站更新、
            解析失敗或其他原因而出現不準確、缺漏或過時之情況。
            你在使用本工具所得到的任何結果、建議與推論，皆僅供參考；請你自行判斷其正確性，
            並自行承擔使用本工具與其結果可能造成的風險與損失。
          </Typography>
        </Alert>

        <Box>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
            使用方式（建議流程）
          </Typography>
          <Stack spacing={0.75} sx={{ pl: 1 }}>
            <Typography>1. 輸入並套用 seed / count</Typography>
            <Typography>2. 選擇一個或多個 event（並指定主要 event）</Typography>
            <Typography>
              3. 選擇目標貓咪（右側清單 / 手機用右上角按鈕）
            </Typography>
            <Typography>
              4. 設定資源（票券、貓罐頭/食物等）與起始位置
            </Typography>
            <Typography>5. 點「Run」產生規劃結果（統計 + 步驟表）</Typography>
          </Stack>
        </Box>

        <Divider />

        <Box>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
            資料來源（爬蟲網址）
          </Typography>

          <Typography color="text.secondary" variant="body2" sx={{ mb: 0.75 }}>
            本工具目前主要依據下列網站作為資料抓取與解析來源：
          </Typography>

          <Typography>
            • {DATA_SOURCES.crawler.name}：
            <Link
              href={DATA_SOURCES.crawler.url}
              target="_blank"
              rel="noreferrer"
              sx={{ ml: 0.5 }}
            >
              {DATA_SOURCES.crawler.url}
            </Link>
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Button
            variant="contained"
            size="large"
            onClick={() => setStarted(true)}
          >
            開始使用
          </Button>

          <Button
            variant="outlined"
            size="large"
            onClick={() => {
              // 你也可以在這裡改成打開 README、或顯示更多資訊
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            回到頂部
          </Button>
        </Stack>

        <Typography variant="caption" color="text.secondary">
          小提醒：若你希望每次進來都直接進規劃器，也可以把 HomePage 改回直接回傳
          &lt;PlannerPage /&gt;，或在此頁加上「不再顯示」的 localStorage 設定。
        </Typography>
      </Stack>
    </Container>
  );
}
