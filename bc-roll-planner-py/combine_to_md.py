#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable, Set, Optional


DEFAULT_EXCLUDES = {
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    ".pytest_cache",
    ".mypy_cache",
    ".idea",
    ".vscode",
}


def iter_files(
    root: Path,
    exts: Set[str],
    excludes: Set[str],
    self_path: Optional[Path] = None,
) -> Iterable[Path]:
    for p in root.rglob("*"):
        if not p.is_file():
            continue

        if any(part in excludes for part in p.parts):
            continue

        if self_path is not None:
            try:
                if p.resolve() == self_path:
                    continue
            except Exception:
                if p.name == self_path.name:
                    continue

        if p.suffix.lower() in exts:
            yield p


def read_text_best_effort(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8", errors="replace")


def main() -> int:
    ap = argparse.ArgumentParser(
        description="遞迴搜尋指定副檔名檔案，將檔名與內容彙整輸出成單一 Markdown。"
    )
    ap.add_argument(
        "root", nargs="?", default=".", help="要掃描的根目錄（預設：目前資料夾）"
    )
    ap.add_argument(
        "--ext",
        action="append",
        default=[".py"],
        help="要包含的副檔名，可重複指定，例如：--ext .py --ext .ts（預設：.py）",
    )
    ap.add_argument(
        "--out", default="combined.md", help="輸出的 md 檔名（預設：combined.md）"
    )
    ap.add_argument(
        "--exclude",
        action="append",
        default=[],
        help="要排除的資料夾名稱，可重複指定，例如：--exclude .git --exclude node_modules",
    )
    ap.add_argument(
        "--exclude-self",
        action="store_true",
        help="排除正在執行的這支 combine_to_md 腳本本身",
    )

    args = ap.parse_args()

    root = Path(args.root).resolve()
    out_path = Path(args.out).resolve()

    exts = {e if e.startswith(".") else f".{e}" for e in args.ext}
    exts = {e.lower() for e in exts}

    excludes = set(DEFAULT_EXCLUDES) | set(args.exclude)
    self_path = Path(__file__).resolve() if args.exclude_self else None

    files = sorted(
        iter_files(root, exts, excludes, self_path=self_path),
        key=lambda p: str(p).lower(),
    )

    lines: list[str] = []
    for f in files:
        rel = f.relative_to(root).as_posix()
        content = read_text_best_effort(f).rstrip("\n")

        # ✅ 你要的格式：檔名一行 + 內容用 code fence 包起來
        lines.append(rel)
        lines.append("```")
        lines.append(content)
        lines.append("```")
        lines.append("")  # 空行分隔

    out_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    print(f"✅ 已輸出：{out_path}（共 {len(files)} 個檔案）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
