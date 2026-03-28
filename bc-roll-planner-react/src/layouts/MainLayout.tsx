import type { PropsWithChildren } from "react";

export default function MainLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.08),transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eff6ff_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
