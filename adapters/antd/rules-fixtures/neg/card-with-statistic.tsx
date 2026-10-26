import { Card, Statistic, Tag } from "antd";

export const Metric = () => (
  <Card title="Revenue">
    <Statistic value={1280} />
    <Tag color="green">+4%</Tag>
  </Card>
);
