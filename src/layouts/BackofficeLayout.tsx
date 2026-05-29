import { Outlet } from "react-router-dom";
import AppLayout from "./AppLayout";
import BackofficeNavbar from "./BackofficeNavbar";
import UserMenu from "@/components/UserMenu";

export default function BackofficeLayout() {
  return (
    <AppLayout left={<BackofficeNavbar />} right={<UserMenu />}>
      <Outlet />
    </AppLayout>
  );
}
