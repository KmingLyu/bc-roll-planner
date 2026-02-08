// src/app/theme/index.ts
import { createTheme } from "@mui/material/styles";
import { APP_THEME_TOKENS } from "./tokens";

/**
 * MUI Theme 設定（亮色，但非全白）
 * - 適合資料表 / planner / 視覺標記密集型 UI
 * - 長時間使用不刺眼
 */
const { palette, surface, input, chip } = APP_THEME_TOKENS;

const theme = createTheme({
  palette: {
    mode: "light",

    primary: {
      main: palette.primary,
      contrastText: "#fff",
    },

    secondary: {
      main: palette.secondary,
    },

    success: {
      main: palette.success,
    },

    warning: {
      main: palette.warning,
    },

    error: {
      main: palette.error,
    },

    info: {
      main: palette.info,
    },

    background: {
      default: palette.backgroundDefault,
      paper: palette.backgroundPaper,
    },

    divider: palette.divider,

    text: {
      primary: palette.textPrimary,
      secondary: palette.textSecondary,
    },
  },

  typography: {
    fontFamily: [
      "IBM Plex Sans",
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

  shape: {
    borderRadius: 10,
  },

  spacing: 8,

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "html, body, #root": {
          minHeight: "100%",
        },
        body: {
          backgroundColor: palette.backgroundDefault,
          backgroundImage: `linear-gradient(180deg, ${surface.bodyTop} 0%, ${surface.bodyBottom} 100%)`,
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          color: palette.textPrimary,
          scrollbarColor: `${surface.scrollbarThumb} ${palette.backgroundDefault}`,
          "&::-webkit-scrollbar": {
            width: 8,
            height: 8,
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: surface.scrollbarThumb,
            borderRadius: 999,
            border: "2px solid transparent",
            backgroundClip: "padding-box",
          },
          "& input[type=number]": {
            MozAppearance: "textfield",
          },
          "& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button":
            {
              WebkitAppearance: "none",
              margin: 0,
            },
        },
        a: {
          color: palette.primary,
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
          border: `1px solid ${surface.paperBorder}`,
          backgroundColor: palette.backgroundPaper,
          boxShadow: surface.paperShadow,
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${surface.tableRowBorder}`,
          padding: "8px 12px",
        },
        head: {
          fontWeight: 600,
          backgroundColor: surface.tableHead,
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: input.background,
          transition:
            "background-color 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
          "& fieldset": {
            borderColor: input.border,
          },
          "&:hover fieldset": {
            borderColor: input.borderHover,
          },
          "&.Mui-focused": {
            backgroundColor: palette.backgroundPaper,
            boxShadow: `0 0 0 2px ${input.focusRing}`,
            "& fieldset": {
              borderColor: palette.primary,
            },
          },
        },
      },
    },

    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: palette.textSecondary,
          fontSize: 13,
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          borderRadius: 8,
        },
        outlined: {
          borderColor: chip.border,
          backgroundColor: chip.background,
        },
      },
    },

    MuiAccordion: {
      styleOverrides: {
        root: {
          border: `1px solid ${surface.paperBorder}`,
          boxShadow: "none",
          backgroundColor: palette.backgroundPaper,
          "&:before": {
            display: "none",
          },
        },
      },
    },

    MuiTableContainer: {
      styleOverrides: {
        root: {
          backgroundColor: palette.backgroundPaper,
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: palette.backgroundPaper,
          borderLeft: `1px solid ${surface.paperBorder}`,
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
