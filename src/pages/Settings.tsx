import { Button } from "@/components/ui/Button";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { workerAPI } from "../api/workers";
import { userAPI } from "../api/users";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { toast } from "react-hot-toast";
import type { Worker } from "../types";
import { PageHeader, inputFieldClass, selectFieldClass } from "@/components/layout/PageChrome";
import { PlatformEmailConfigCard } from "@/components/admin/PlatformEmailConfigCard";
import { CheckoutBrandingSettings } from "@/components/checkout/CheckoutBrandingSettings";
import { TenantEmailSettings } from "@/components/settings/TenantEmailSettings";

export default function Settings() {
  const { user, refreshUser } = useAuth();

  // Stato cambio password personale
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Stato workers
  const isAdmin = user?.role === "admin" || user?.role === "backoffice";
  const isPlatformAdmin = Boolean(user?.isPlatformAdmin);
  const isTenantAdmin = user?.role === "admin" && !isPlatformAdmin;
  const checkoutDigitalEnabled = Boolean(user?.checkoutDigitalEnabled);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [adminNewPassword, setAdminNewPassword] = useState("");

  // Carico workers
  useEffect(() => {
    async function loadWorkers() {
      if (!user) return;

      if (isAdmin && !isPlatformAdmin) {
        const mapped = await workerAPI.list();
        setWorkers(mapped.filter((w) => w.role !== "admin"));
      } else if (!isPlatformAdmin) {
        const allWorkers = await workerAPI.list();
        setWorkers(allWorkers.filter((w) => w.id === user.workerId));
      }
    }

    loadWorkers();
  }, [isAdmin, isPlatformAdmin, user]);

  // Cambio password personale
  async function handlePasswordChange() {
    if (!newPassword || !confirmPassword) {
      toast.error("⚠️ Compila entrambi i campi");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("❌ Le password non coincidono");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("❌ La password deve avere almeno 6 caratteri");
      return;
    }

    try {
      await userAPI.changePassword(newPassword);
      toast.success("✅ Password aggiornata con successo!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Errore imprevisto";
      toast.error(`❌ Errore imprevisto: ${message}`);
    }
  }

  // Reset password admin/backoffice
  async function handleAdminPasswordReset() {
    if (!selectedWorker || !adminNewPassword) {
      toast.error("⚠️ Seleziona un utente e inserisci la nuova password");
      return;
    }
    if (adminNewPassword.length < 6) {
      toast.error("❌ La password deve avere almeno 6 caratteri");
      return;
    }

    try {
      await userAPI.resetPassword(selectedWorker, adminNewPassword);

      toast.success("✅ Password aggiornata con successo!");
      setSelectedWorker("");
      setAdminNewPassword("");
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Errore imprevisto";
      toast.error(`❌ Errore imprevisto: ${message}`);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Impostazioni"
        description={
          isPlatformAdmin
            ? "Profilo, password e configurazione piattaforma."
            : "Profilo, password e gestione accessi."
        }
      />

      {isPlatformAdmin && <PlatformEmailConfigCard />}

      {/* Profilo */}
      <Card>
        <CardHeader>
          <CardTitle>Profilo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <b>Nome:</b> {user?.name ?? "—"}
          </div>
          <div>
            <b>Email:</b> {user?.email ?? "—"}
          </div>
          <div>
            <b>Ruolo:</b> {user?.role ?? "—"}
          </div>
        </CardContent>
      </Card>

      {/* Password personale */}
      <Card>
        <CardHeader>
          <CardTitle>🔒 Cambia la tua password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="password"
            placeholder="Nuova password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputFieldClass}
          />
          <input
            type="password"
            placeholder="Conferma password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputFieldClass}
          />
          <Button
            onClick={handlePasswordChange}
            variant="primary"
            className="w-full px-4 py-2.5 text-center font-semibold sm:w-auto"
          >
            Aggiorna password
          </Button>
        </CardContent>
      </Card>

      {/* Reset password admin/backoffice */}
      {isAdmin && !isPlatformAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>🔑 Reset password utente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              value={selectedWorker}
              onChange={(e) => setSelectedWorker(e.target.value)}
              className={selectFieldClass}
            >
              <option value="">Seleziona utente</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <input
              type="password"
              placeholder="Nuova password"
              value={adminNewPassword}
              onChange={(e) => setAdminNewPassword(e.target.value)}
              className={inputFieldClass}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={handleAdminPasswordReset}
                variant="primary"
                className="w-full px-4 py-2.5 text-center font-semibold sm:w-auto"
              >
                Reset password
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isTenantAdmin && checkoutDigitalEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Modulo fine lavori (checkout digitale)</CardTitle>
          </CardHeader>
          <CardContent>
            <CheckoutBrandingSettings
              onSaved={async () => {
                await refreshUser();
              }}
            />
          </CardContent>
        </Card>
      )}

      {isTenantAdmin && (checkoutDigitalEnabled || user?.reviewRequestEnabled) && (
        <Card>
          <CardHeader>
            <CardTitle>Email a clienti</CardTitle>
          </CardHeader>
          <CardContent>
            <TenantEmailSettings />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
