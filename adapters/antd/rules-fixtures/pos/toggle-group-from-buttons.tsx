import { Button } from "antd";

export function Toggle({ mode, setMode }: { mode: string; setMode: (m: string) => void }) {
  return (
    <div>
      <Button type={mode === "a" ? "primary" : "default"} onClick={() => setMode("a")}>A</Button>
      <Button type={mode === "b" ? "primary" : "default"} onClick={() => setMode("b")}>B</Button>
    </div>
  );
}
