// src/theme/index.ts
import { createTheme } from "@mui/material/styles";

/**
 * MUI Theme 設定（亮色，但非全白）
 * - 適合資料表 / planner / 視覺標記密集型 UI
 * - 長時間使用不刺眼
 */
const theme = createTheme({
  palette: {
    mode: "light",

    primary: {
      main: "#1976d2", // 藍（主要操作、Event）
      contrastText: "#fff",
    },

    secondary: {
      main: "#2e7d32", // 綠（目標、成功）
    },

    success: {
      main: "#388e3c",
    },

    warning: {
      main: "#ed6c02",
    },

    error: {
      main: "#d32f2f",
    },

    info: {
      main: "#0288d1",
    },

    background: {
      default: "#f4f6f8", // ❗非純白，整體背景
      paper: "#ffffff", // 卡片 / 表格底色
    },

    divider: "rgba(0,0,0,0.12)",

    text: {
      primary: "#1f2933",
      secondary: "#4b5563",
    },
  },

  typography: {
    fontFamily: [
      "Inter",
      "Noto Sans TC",
      "-apple-system",
      "BlinkMacSystemFont",
      "Segoe UI",
      "Roboto",
      "Helvetica",
      "Arial",
      "sans-serif",
    ].join(","),

    fontSize: 14,

    h1: { fontSize: "1.8rem", fontWeight: 600 },
    h2: { fontSize: "1.6rem", fontWeight: 600 },
    h3: { fontSize: "1.4rem", fontWeight: 600 },
    h4: { fontSize: "1.2rem", fontWeight: 600 },
    h5: { fontSize: "1.1rem", fontWeight: 600 },
    h6: { fontSize: "1rem", fontWeight: 600 },
  },

  // shape: {
  //   borderRadius: 8,
  // },

  spacing: 8,

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#f4f6f8",
          scrollbarColor: "#c1c1c1 #f4f6f8",
          "&::-webkit-scrollbar": {
            width: 8,
            height: 8,
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "#c1c1c1",
            // borderRadius: 4,
          },
        },
      },
    },

    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 8,
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(0,0,0,0.06)",
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          padding: "8px 12px",
        },
        head: {
          fontWeight: 600,
          backgroundColor: "#f0f2f5", // 表頭淡灰
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: "0.8rem",
        },
      },
    },
  },
});

export default theme;
