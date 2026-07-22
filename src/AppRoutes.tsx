import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { lazy, Suspense, useEffect, useRef, type ReactNode } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import toast from "react-hot-toast";

import ProtectedLayout from "./routes/ProtectedLayout";
import WorkerLayout from "./layouts/NewsaverplastLayout";
import BackofficeLayout from "./layouts/NewsaverplastLayout";
import AuthLayout from "./layouts/AuthLayoutNewsaverplast";
import PageLoader from "@/components/ui/PageLoader";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

import Login from "./pages/Login";
import Agenda from "./pages/Agenda";
import Home from "./pages/backoffice/Home";
import Assistenza from "./pages/backoffice/Assistenza";
import Customers from "./pages/backoffice/Customers";
import Orders from "./pages/backoffice/Orders";
import OfficeBoard from "./pages/backoffice/OfficeBoard";
import LibronePending from "./pages/backoffice/LibronePending";
import NewJob from "./pages/backoffice/NewJob";
import CustomerDetail from "./pages/backoffice/CustomerDetail";
import Montatori from "./pages/backoffice/Montatori";
import Settings from "./pages/Settings";
import MyJobs from "./pages/MyJobs";
import { PushOnboardingModal } from "@/components/PushOnboardingModal";

const JobDetail = lazy(() => import("./pages/JobDetail"));
const OrderDetail = lazy(() => import("./pages/backoffice/OrderDetail"));
const Documenti = lazy(() => import("./pages/backoffice/Documenti"));
const Report = lazy(() => import("./pages/backoffice/Report"));
const EconomicDashboard = lazy(() => import("@/pages/backoffice/EconomicDashboard"));
const SuperAdminPage = lazy(() => import("@/pages/backoffice/SuperAdmin"));
const CollectionsOverview = lazy(() => import("@/pages/backoffice/CollectionsOverview"));
const ActivityLogPage = lazy(() => import("@/pages/backoffice/ActivityLog"));
const TenantBackupsPage = lazy(() => import("@/pages/backoffice/TenantBackups"));
const AppVersionAdminPage = lazy(() => import("@/pages/backoffice/AppVersionAdmin"));
const PushNotificationsPage = lazy(
  () => import("@/pages/backoffice/PushNotifications")
);

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

const AppRoutesInner = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const lastBackPress = useRef(0);


  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handler: PluginListenerHandle | undefined;

    void CapacitorApp.addListener("backButton", () => {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        const now = Date.now();
        if (now - lastBackPress.current < 2000) {
          CapacitorApp.exitApp();
        } else {
          toast("Premi di nuovo indietro per uscire");
          lastBackPress.current = now;
        }
      }
    }).then((h) => {
      handler = h;
    });

    return () => {
      handler?.remove();
    };
  }, [navigate]);

  const getHomeRoute = () => {
    if (!user) return "/login";
    if (user.isPlatformAdmin) return "/backoffice/super-admin";
    if (user.role === "worker") return "/agenda";
    return "/backoffice/agenda";
  };

  return (
    <>
    <PushOnboardingModal user={user} />
    <Routes>
      {!user ? (
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
        </Route>
      ) : (
        <Route
          path="/login"
          element={<Navigate to={getHomeRoute()} replace />}
        />
      )}

      {user && (
        <Route element={<ProtectedLayout />}>
          {user.role === "worker" && (
            <Route element={<WorkerLayout />}>
              <Route
                path="/agenda"
                element={
                  <RouteErrorBoundary>
                    <Agenda />
                  </RouteErrorBoundary>
                }
              />
              <Route
                path="/my-jobs"
                element={
                  <RouteErrorBoundary>
                    <MyJobs />
                  </RouteErrorBoundary>
                }
              />
              <Route
                path="/jobs/:id"
                element={
                  <LazyPage>
                    <JobDetail />
                  </LazyPage>
                }
              />
              <Route path="/settings" element={<Settings />} />
            </Route>
          )}

          {(user.role === "backoffice" || user.role === "admin") && !user.isPlatformAdmin && (
            <Route element={<BackofficeLayout />}>
              <Route path="/backoffice/home" element={<Home />} />
              <Route path="/backoffice/assistenza" element={<Assistenza />} />
              <Route path="/backoffice/customers" element={<Customers />} />
              <Route
                path="/backoffice/customers/:id"
                element={<CustomerDetail />}
              />
              <Route path="/backoffice/orders" element={<Orders />} />
              <Route path="/backoffice/office" element={<OfficeBoard />} />
              <Route
                path="/backoffice/office/librone-pending"
                element={<LibronePending />}
              />
              <Route
                path="/backoffice/orders/:id"
                element={
                  <LazyPage>
                    <OrderDetail />
                  </LazyPage>
                }
              />
              <Route path="/backoffice/newjob" element={<NewJob />} />
              <Route path="/backoffice/montatori" element={<Montatori />} />
              <Route
                path="/backoffice/documenti"
                element={
                  <LazyPage>
                    <Documenti />
                  </LazyPage>
                }
              />
              <Route
                path="/backoffice/collections-overview"
                element={
                  <LazyPage>
                    <CollectionsOverview />
                  </LazyPage>
                }
              />

              {user.role === "admin" && !user.isPlatformAdmin && (
                <>
                  <Route
                    path="/backoffice/report"
                    element={
                      <LazyPage>
                        <Report />
                      </LazyPage>
                    }
                  />
                  <Route
                    path="/backoffice/push-notifications"
                    element={
                      <LazyPage>
                        <PushNotificationsPage />
                      </LazyPage>
                    }
                  />
                  <Route
                    path="/backoffice/activity-log"
                    element={
                      <LazyPage>
                        <ActivityLogPage />
                      </LazyPage>
                    }
                  />
                </>
              )}
              <Route
                path="/backoffice/economic-dashboard"
                element={
                  <LazyPage>
                    <EconomicDashboard />
                  </LazyPage>
                }
              />

              <Route
                path="/backoffice/jobs/:id"
                element={
                  <LazyPage>
                    <JobDetail />
                  </LazyPage>
                }
              />
              <Route path="/backoffice/settings" element={<Settings />} />
              <Route path="/backoffice/agenda" element={<Agenda />} />
            </Route>
          )}

          {user.role === "admin" && user.isPlatformAdmin && (
            <Route path="/backoffice/*" element={<BackofficeLayout />}>
              <Route index element={<Navigate to="/backoffice/super-admin" replace />} />
              <Route
                path="super-admin"
                element={
                  <LazyPage>
                    <SuperAdminPage />
                  </LazyPage>
                }
              />
              <Route
                path="activity-log"
                element={
                  <LazyPage>
                    <ActivityLogPage />
                  </LazyPage>
                }
              />
              <Route
                path="backups"
                element={
                  <LazyPage>
                    <TenantBackupsPage />
                  </LazyPage>
                }
              />
              <Route
                path="tenant-backups"
                element={<Navigate to="/backoffice/backups" replace />}
              />
              <Route
                path="app-version"
                element={
                  <LazyPage>
                    <AppVersionAdminPage />
                  </LazyPage>
                }
              />
              <Route path="settings" element={<Settings />} />
            </Route>
          )}

          <Route
            path="/home"
            element={<Navigate to={getHomeRoute()} replace />}
          />
        </Route>
      )}

      <Route path="*" element={<Navigate to={getHomeRoute()} replace />} />
    </Routes>
    </>
  );
};

/** Web GitHub Pages: /Ns-cantieri-saas/ — APK (base ./): nessun basename */
function resolveRouterBasename(baseUrl: string): string | undefined {
  const base = (baseUrl ?? "/").trim();
  if (base === "/" || base === "./" || base === ".") return undefined;
  return base.replace(/\/$/, "") || undefined;
}

const routerBasename = resolveRouterBasename(import.meta.env.BASE_URL);

const AppRoutes = () => (
  <Router basename={routerBasename}>
    <AppRoutesInner />
  </Router>
);

export default AppRoutes;
