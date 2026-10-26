---
title: Loading, empty and error states
intents: ["loading state", "empty state", "error state", "skeleton", "состояния загрузки", "пустое состояние", "ошибка"]
components: [Skeleton, Spin, Empty, Result, Alert]
---
Every screen that fetches data handles three states besides the happy path.

**Lists and tables**
- Loading: pass `loading` to `Table`/`List`, or render `Skeleton` rows on first load.
- Empty: `Empty` with a short message and, when useful, a primary `Button` to create the first item.
- Error: an `Alert type="error"` above the list with a retry `Button`.

**Forms**
- Loading initial values: wrap fields in `Skeleton` or `Spin`; show `loading` on the submit `Button` while saving.
- Error on submit: field errors through `Form.Item` rules; a request-level failure as `Alert type="error"`.

**Detail pages**
- Loading: `Skeleton` shaped like the page (`Skeleton.Avatar`, paragraphs), not a bare spinner.
- Not found or failed: `Result status="404"` or `status="500"` with a back `Button`.
- Empty sections: `Empty` inside the section, not an empty card.

Use `Spin` only for short, inline waits over existing content.
