import { useEffect, useState } from "react";
import { cn } from "@/components/ui/cn";
import { inputFieldClass, surfaceCardClass } from "@/components/layout/PageChrome";

type LocalFile = {
  id: string;
  file: File;
  preview?: string;
};

export function UploadArea({
  onChange,
  initialFiles = [],
  noteLabel = "Note intervento",
  onNoteChange,
  initialNote = "",
}: {
  onChange?: (files: File[]) => void;
  initialFiles?: LocalFile[];
  noteLabel?: string;
  onNoteChange?: (note: string) => void;
  initialNote?: string;
}) {
  const [note, setNote] = useState(initialNote);
  const [files, setFiles] = useState<LocalFile[]>(initialFiles);

  useEffect(() => {
    onNoteChange?.(note);
  }, [note, onNoteChange]);

  function handleFiles(selected: FileList | null) {
    if (!selected) return;
    const arr = Array.from(selected);
    const locals = arr.map((f) => {
      let preview: string | undefined;
      if (f.type.startsWith("image/") || f.type.startsWith("video/")) {
        preview = URL.createObjectURL(f);
      }
      return { id: crypto.randomUUID(), file: f, preview };
    });
    const next = [...files, ...locals];
    setFiles(next);
    onChange?.(next.map((x) => x.file));
  }

  function removeFile(id: string) {
    const next = files.filter((i) => i.id !== id);
    setFiles(next);
    onChange?.(next.map((x) => x.file));
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-slate-700">{noteLabel}</span>
        <textarea
          className={cn(inputFieldClass, "mt-2 min-h-[120px] resize-y")}
          placeholder="Scrivi qui eventuali note…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <div className={cn(surfaceCardClass, "p-4")}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-slate-800">Allegati</div>
          <label className="cursor-pointer text-sm font-medium text-brand transition hover:text-brand-dark">
            Carica file
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
        </div>

        {files.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center text-sm text-slate-500">
            Nessun file caricato.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {files.map((f) => (
              <div
                key={f.id}
                className="group relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50/80 p-2 text-xs text-slate-600"
              >
                {f.preview ? (
                  f.file.type.startsWith("image/") ? (
                    <img
                      src={f.preview}
                      alt={f.file.name}
                      className="h-24 w-full rounded-lg object-cover"
                    />
                  ) : f.file.type.startsWith("video/") ? (
                    <video
                      src={f.preview}
                      className="h-24 w-full rounded-lg object-cover"
                      controls
                    />
                  ) : null
                ) : (
                  <span className="text-3xl">📎</span>
                )}
                <div className="mt-1 w-full truncate text-center">{f.file.name}</div>
                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  className="absolute right-1 top-1 rounded-md bg-white/95 px-2 py-0.5 text-xs text-red-600 opacity-0 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-white group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
