import type { DetectorRule, RuleHelpers } from "../../../src/adapter/types.js";

export default function rules(h: RuleHelpers): DetectorRule[] {
  return [
    {
      id: "raw-button",
      suggest: "Button",
      description: "Use Button instead of a raw <button> element.",
      rule: {
        meta: {
          type: "suggestion",
          schema: [],
          messages: { raw: "Use Button instead of a raw <button> element." },
        },
        create(context) {
          return {
            JSXOpeningElement(node) {
              if (h.jsxName(node) === "button") {
                context.report({ node, messageId: "raw" });
              }
            },
          };
        },
      },
    },
  ];
}
