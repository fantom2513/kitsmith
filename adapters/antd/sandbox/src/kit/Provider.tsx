import { App, ConfigProvider } from "antd";
import type { ReactNode } from "react";

/** App-wide antd setup: put the project theme tokens here. */
export function Provider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider theme={{ token: { borderRadius: 6 } }}>
      <App>{children}</App>
    </ConfigProvider>
  );
}
