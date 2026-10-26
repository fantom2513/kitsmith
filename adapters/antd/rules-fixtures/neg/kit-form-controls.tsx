import { Input, Select, Table, Button } from "antd";

export const Form = () => (
  <div>
    <Input placeholder="Name" />
    <Select options={[]} />
    <Table columns={[]} dataSource={[]} />
    <Button>Go</Button>
  </div>
);
