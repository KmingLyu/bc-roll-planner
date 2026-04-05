import type { ComponentType } from "react";
import HomePage from "@/pages/HomePage";
import PlannerPage from "@/pages/PlannerPage";

const ROUTE_MAP: Record<string, ComponentType> = {
  "/": HomePage,
  "/planner": PlannerPage,
};

function normalizePathname(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed || trimmed === "/") return "/";
  return trimmed.replace(/\/+$/, "");
}

export default function AppRouter() {
  const pathname = normalizePathname(window.location.pathname);
  const RouteComponent = ROUTE_MAP[pathname] ?? HomePage;

  return <RouteComponent />;
}
