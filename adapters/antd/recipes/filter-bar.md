---
title: Filter bar
intents: ["filter bar", "toolbar with filters", "search and filter", "table filters", "панель фильтров", "фильтры"]
components: [Space, Input, Select, DatePicker, Segmented, Button]
---
Use above a list or table to narrow results. Lay controls out with `Space` (wrapping on small widths),
use `Segmented` for a short exclusive choice such as a view or status, `Select` for longer lists, and
`Button` for applying or resetting. Keep the filter state in one place.

```tsx
import { useState } from "react";
import { Button, DatePicker, Input, Segmented, Select, Space } from "antd";

export function FilterBar({ onApply }: { onApply: (filters: Record<string, unknown>) => void }) {
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState<string | undefined>();

  return (
    <Space wrap>
      <Segmented
        value={status}
        onChange={setStatus}
        options={[
          { label: "All", value: "all" },
          { label: "Active", value: "active" },
          { label: "Archived", value: "archived" },
        ]}
      />
      <Input.Search placeholder="Search" allowClear value={query} onChange={(e) => setQuery(e.target.value)} />
      <Select
        placeholder="Owner"
        allowClear
        style={{ width: 160 }}
        value={owner}
        onChange={setOwner}
        options={[
          { label: "Alice", value: "alice" },
          { label: "Bob", value: "bob" },
        ]}
      />
      <DatePicker.RangePicker />
      <Button type="primary" onClick={() => onApply({ status, query, owner })}>
        Apply
      </Button>
      <Button
        onClick={() => {
          setStatus("all");
          setQuery("");
          setOwner(undefined);
        }}
      >
        Reset
      </Button>
    </Space>
  );
}
```
