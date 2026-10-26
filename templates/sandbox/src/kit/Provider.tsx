import type { ReactNode } from "react";

/** App-wide wrapper for the UI kit (theme, global config). Passthrough by default. */
export function Provider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
