import type { DetectorRule, RuleHelpers } from "../../../src/adapter/types.js";

export default function rules(_h: RuleHelpers): DetectorRule[] {
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
              if (node.name.type === "JSXIdentifier" && node.name.name === "button") {
                context.report({ node, messageId: "raw" });
              }
            },
          };
        },
      },
    },
  ];
}
