---
title: Metric card
intents: ["metric card", "kpi tile", "headline number", "dashboard stat", "карточка метрики", "показатель"]
components: [Card, Statistic, Tag]
---
Use for one headline number with a label and an optional trend. Put the label in the `Card` title,
the number in `Statistic`, and the change in a `Tag`. Do not hand-style a `div` as a card.

```tsx
import { Card, Statistic, Tag } from "antd";

export function MetricCard({ title, value, change }: { title: string; value: number; change: number }) {
  return (
    <Card title={title}>
      <Statistic value={value} />
      <Tag color={change >= 0 ? "green" : "red"}>
        {change >= 0 ? "+" : ""}
        {change}%
      </Tag>
    </Card>
  );
}
```
