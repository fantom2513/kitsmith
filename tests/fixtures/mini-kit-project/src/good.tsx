import { Button, Table } from "mini-kit";

export const Good = () => (
  <div>
    <Button type="primary">Ok</Button>
    <Table columns={[{ title: "Name", dataIndex: "name" }]} />
  </div>
);
