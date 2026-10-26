import { Button, Card, Segmented } from "mini-kit";

export const Composed = () => (
  <Card title="Composed">
    <Button type="primary">Go</Button>
    <Segmented options={["a", "b"]} />
  </Card>
);
