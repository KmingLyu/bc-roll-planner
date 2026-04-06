import { PlannerPageContainer } from "@/features/planner";
import MainLayout from "@/layouts/MainLayout";

export default function AppRouter() {
  return (
    <MainLayout>
      <PlannerPageContainer />
    </MainLayout>
  );
}
