import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
};

export function SignaturePad({ onChange, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const emit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const blank = document.createElement("canvas");
    blank.width = canvas.width;
    blank.height = canvas.height;
    const isBlank = canvas.toDataURL() === blank.toDataURL();
    onChange(isBlank ? null : canvas.toDataURL("image/png"));
  }, [onChange]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    canvas.width = Math.floor(rect.width * 2);
    canvas.height = Math.floor(rect.height * 2);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(2, 2);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  useEffect(() => {
    initCanvas();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      if (!drawing.current) initCanvas();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [initCanvas]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-600">
        Il cliente firma con il dito o il pennino sul riquadro sottostante.
      </p>
      <canvas
        ref={canvasRef}
        className="h-52 w-full touch-none rounded-xl border-2 border-dashed border-slate-300 bg-white sm:h-40"
        onPointerDown={(e) => {
          if (disabled) return;
          e.preventDefault();
          drawing.current = true;
          canvasRef.current?.setPointerCapture(e.pointerId);
          const ctx = canvasRef.current?.getContext("2d");
          const { x, y } = point(e);
          ctx?.beginPath();
          ctx?.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current || disabled) return;
          e.preventDefault();
          const ctx = canvasRef.current?.getContext("2d");
          const { x, y } = point(e);
          ctx?.lineTo(x, y);
          ctx?.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
          emit();
        }}
        onPointerLeave={() => {
          if (drawing.current) {
            drawing.current = false;
            emit();
          }
        }}
      />
      <Button
        type="button"
        variant="neutral"
        className="min-h-11 w-full text-sm sm:w-auto"
        onClick={clear}
        disabled={disabled}
      >
        Cancella firma
      </Button>
    </div>
  );
}
