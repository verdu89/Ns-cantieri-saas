import { useRef } from "react";

export function usePreventDoubleClick<T extends (...args: never[]) => void | Promise<void>>(
  callback?: T
): T | undefined {
  const isRunning = useRef(false);

  if (!callback) return undefined;

  const wrapped = (async (...args: Parameters<T>) => {
    if (isRunning.current) return;
    isRunning.current = true;

    try {
      await callback(...args);
    } finally {
      isRunning.current = false;
    }
  }) as T;

  return wrapped;
}
