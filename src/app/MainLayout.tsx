import type { PropsWithChildren } from "react";

export default function MainLayout({ children }: PropsWithChildren) {
  return (
    <div className="workspace-shell">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-3 py-3 sm:px-5 sm:py-4 lg:px-6 lg:py-4">
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
