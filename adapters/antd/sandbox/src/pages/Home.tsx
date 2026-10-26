import { Card, List, Typography } from "antd";
import { Link } from "react-router";
import { routes } from "../routes";

export function Home() {
  const pages = routes.flatMap((r) => {
    const title = (r.handle as { title?: string } | undefined)?.title;
    return title && r.path && r.path !== "/" ? [{ path: r.path, title }] : [];
  });
  return (
    <Card title={<Typography.Title level={3}>Prototype</Typography.Title>}>
      <List
        dataSource={pages}
        locale={{ emptyText: "No pages yet. Register one in src/routes.tsx." }}
        renderItem={(p) => (
          <List.Item>
            <Link to={p.path}>{p.title}</Link>
          </List.Item>
        )}
      />
    </Card>
  );
}
