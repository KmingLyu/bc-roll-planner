import * as React from "react";
import { Avatar, Box, Link, Stack, Typography } from "@mui/material";

function getCatImageUrl(catId: number) {
  const index = catId - 1;
  const index3 = String(index).padStart(3, "0");

  return `https://bc.godfat.org/extract/tw/uni${index3}_f00.png`;
}

// 可選擇的貓咪項目
export type CatSelectableItemProps = {
  catId: number;
  name: string;

  checked: boolean;
  onToggle: (next: boolean) => void;

  /** 若未提供，會自動用 bc.godfat 的圖片 */
  imageUrl?: string;
  href?: string;

  dense?: boolean;
  secondary?: React.ReactNode;
};

export function CatSelectableItem(props: CatSelectableItemProps) {
  const {
    catId,
    name,
    checked,
    onToggle,
    imageUrl,
    href,
    dense = true,
    secondary,
  } = props;

  const resolvedImageUrl = imageUrl ?? getCatImageUrl(catId);
  // console.log("CatSelectableItem render", catId, name, resolvedImageUrl);

  return (
    <Box
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onToggle(!checked)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle(!checked);
        }
      }}
      sx={{
        borderRadius: 2,
        // border: "0.5px solid",
        bgcolor: checked ? "primary.main" : "transparent",
        color: checked ? "primary.contrastText" : "text.primary",
        cursor: "pointer",
        userSelect: "none",
        px: dense ? 1 : 1.25,
        py: dense ? 0.25 : 0.75,
        minHeight: dense ? 44 : 56,
        display: "flex",
        alignItems: "center",
        transition: "background-color .2s ease, transform .16s ease",
        "&:hover": {
          bgcolor: checked ? "primary.dark" : "action.hover",
        },
        "&:active": {
          transform: "translateY(2px)",
        },
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: checked ? "primary.contrastText" : "primary.main",
          outlineOffset: 2,
        },
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ width: "100%", minWidth: 0 }}
      >
        <Avatar
          src={resolvedImageUrl}
          variant="rounded"
          sx={{
            width: 35,
            height: 35,
            overflow: "hidden", // 確保 zoom 不會溢出
            bgcolor: checked ? "rgba(255,255,255,0.2)" : "action.selected",
            color: checked ? "primary.contrastText" : "text.primary",

            "& img": {
              transform: "scale(1.7)", // ← 這裡調整 zoom 程度
              transformOrigin: "center",
            },
          }}
        >
          {name?.[0] ?? "?"}
        </Avatar>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="body2"
            noWrap
            title={name}
            sx={{ fontWeight: 600 }}
          >
            {href ? (
              <Link
                href={href}
                target="_blank"
                rel="noreferrer"
                underline="hover"
                color="inherit"
                onClick={(e) => e.stopPropagation()}
              >
                {name}
              </Link>
            ) : (
              name
            )}
          </Typography>

          <Typography
            variant="caption"
            sx={{
              color: checked ? "rgba(255,255,255,0.85)" : "text.secondary",
            }}
          >
            #{catId}
          </Typography>
        </Box>

        {secondary ? (
          <Box sx={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
            {secondary}
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}
