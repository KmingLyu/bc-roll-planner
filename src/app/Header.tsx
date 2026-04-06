import { Announcements } from "./Announcements";

export function Header() {
  return (
    <header className="space-y-2 border-b border-border/45 pb-3">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          貓咪大戰爭抽卡規劃
        </h1>
      </div>
      <Announcements />
    </header>
  );
}
