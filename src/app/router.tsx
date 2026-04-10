import { PlannerPageContainer } from "@/features/planner";
import MainLayout from "@/app/MainLayout";

export default function AppRouter() {
  return (
    <MainLayout>
      <PlannerPageContainer />
    </MainLayout>
  );
}
