import { Outlet } from "react-router-dom";
import AppLayout from "./AppLayout";
import WorkerNavbar from "./WorkerNavbar";
import UserMenu from "@/components/UserMenu";

export default function WorkerLayout() {
  return (
    <AppLayout left={<WorkerNavbar />} right={<UserMenu />}>
      <Outlet />
    </AppLayout>
  );
}
