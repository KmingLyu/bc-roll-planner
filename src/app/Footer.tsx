import { GitBranch, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-2 border-t border-border/45 pt-5 pb-2 sm:pt-6 sm:pb-3">
      <div className="flex justify-end">
        <div className="flex max-w-[760px] flex-wrap items-center justify-end gap-x-3 gap-y-2.5 text-[15px] text-muted-foreground/85">
          <span className="text-[14px] font-semibold text-muted-foreground/75">
            問題回報：
          </span>

          <span className="text-border/80">·</span>

          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
            <a
              href="mailto:keming0325@gmail.com"
              title="keming0325@gmail.com"
              aria-label="寄信到 keming0325@gmail.com"
              className="group inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <Mail className="size-[18px] shrink-0" />
              <span className="font-medium">Email</span>
            </a>

            <span className="text-border/80">·</span>

            <a
              href="https://github.com/KmingLyu/bc-roll-planner"
              target="_blank"
              rel="noreferrer"
              title="github.com/KmingLyu/bc-roll-planner"
              aria-label="前往 GitHub 專案頁回報 issue"
              className="group inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <GitBranch className="size-[18px] shrink-0" />
              <span className="font-medium">GitHub</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
