import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

export type LayoutType = "auth" | "backoffice" | "worker";

type LayoutContextType = {
  layout: LayoutType;
  setLayout: (l: LayoutType) => void;
};

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState<LayoutType>("auth"); // 👈 default

  return (
    <LayoutContext.Provider value={{ layout, setLayout }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayout must be used inside LayoutProvider");
  return ctx;
}
