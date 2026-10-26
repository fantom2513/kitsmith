---
title: Settings form
intents: ["settings form", "profile form", "preferences page", "edit form with validation", "форма настроек", "форма профиля"]
components: [Form, Form.Item, Input, Select, Switch, Button]
---
Use for editing a record or preferences. A vertical `Form` with one `Form.Item` per field carries
labels, `rules` for validation and the submit handler; never wire up validation by hand. Put the
actions at the end and show a loading state on submit while saving.

```tsx
import { useState } from "react";
import { Button, Form, Input, Select, Space, Switch } from "antd";

interface Settings {
  name: string;
  email: string;
  language: string;
  notifications: boolean;
}

export function SettingsForm({ initial, onSave }: { initial: Settings; onSave: (v: Settings) => Promise<void> }) {
  const [form] = Form.useForm<Settings>();
  const [saving, setSaving] = useState(false);

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initial}
      onFinish={async (values) => {
        setSaving(true);
        try {
          await onSave(values);
        } finally {
          setSaving(false);
        }
      }}
    >
      <Form.Item name="name" label="Name" rules={[{ required: true, message: "Enter a name" }]}>
        <Input />
      </Form.Item>
      <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
        <Input />
      </Form.Item>
      <Form.Item name="language" label="Language">
        <Select
          options={[
            { label: "English", value: "en" },
            { label: "Russian", value: "ru" },
          ]}
        />
      </Form.Item>
      <Form.Item name="notifications" label="Email notifications" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Space>
        <Button type="primary" htmlType="submit" loading={saving}>
          Save
        </Button>
        <Button htmlType="reset">Reset</Button>
      </Space>
    </Form>
  );
}
```
