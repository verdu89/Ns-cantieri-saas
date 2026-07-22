import { Button } from "@/components/ui/Button";
import {
  modalActionsClass,
  modalBackdropClass,
  modalPanelClass,
  modalSafeFooterClass,
} from "@/components/layout/PageChrome";
import { cn } from "@/components/ui/cn";

interface ConfirmDialogProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  title?: string;
  description: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void; // 👈 opzionale
}

export function ConfirmDialog({
  open,
  setOpen,
  title = "Conferma azione",
  description,
  confirmText = "Conferma",
  cancelText = "Annulla",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className={modalBackdropClass}>
      <div
        className={cn(
          modalPanelClass,
          modalSafeFooterClass,
          "max-w-md space-y-4 p-5 pt-6 sm:p-6 animate-fadeIn"
        )}
      >
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        <div className="text-sm text-slate-600">{description}</div>
        <div className={modalActionsClass}>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onCancel?.();
              setOpen(false);
            }}
            className="py-2.5 font-medium"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={async () => {
              await onConfirm();
              setOpen(false);
            }}
            className="py-2.5 font-semibold"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
