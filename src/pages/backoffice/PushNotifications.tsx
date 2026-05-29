import PushBroadcastPanel from "@/components/admin/PushBroadcastPanel";
import { PageHeader } from "@/components/layout/PageChrome";

export default function PushNotifications() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifiche push"
        description="Invia messaggi agli utenti che hanno attivato le notifiche sull'app."
      />
      <PushBroadcastPanel />
    </div>
  );
}
