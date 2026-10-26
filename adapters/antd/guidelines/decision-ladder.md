---
title: Decision ladder for antd
intents: ["which component", "how to choose", "build ui with antd", "decision ladder", "как выбрать компонент"]
components: [Card, Segmented, Space, Flex]
---
Work down the ladder and stop at the first rung that fits.

1. **Find an antd component.** Search by intent before writing markup. If a component exists, use it; do
   not rebuild it from `div`, `button`, `input`, `select` or `table`. Toggling buttons are `Segmented`,
   a bordered box is `Card`, a number with a label is `Statistic`.
2. **Compose antd components.** Combine several (a `Card` holding `Statistic` and `Tag`; a filter bar of
   `Space`, `Segmented`, `Select`). Check a recipe first.
3. **Use a layout primitive.** For spacing and alignment use `Space`, `Flex`, `Row` and `Col`, and theme
   tokens (`theme.useToken()`) instead of hard-coded colors and sizes.
4. **Allowed external.** Charts come from `@ant-design/charts` and icons from `@ant-design/icons`.
5. **Custom element last.** Only when nothing above fits, write a small custom element, keep it
   token-styled, and say why no antd component fit.

Always confirm prop names with the props tool rather than guessing, and run validate before finishing.
