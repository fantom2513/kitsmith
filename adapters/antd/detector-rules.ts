import type { Rule } from "eslint";
import type { DetectorRule, RuleHelpers } from "../../src/adapter/types.js";

type OpeningElement = Parameters<RuleHelpers["jsxName"]>[0];

/** A rule that visits every JSX opening element; `check` returns a message to report, if any. */
function jsxRule(
  id: string,
  suggest: string,
  description: string,
  check: (node: OpeningElement, context: Rule.RuleContext) => string | undefined,
): DetectorRule {
  return {
    id,
    suggest,
    description,
    rule: {
      meta: { type: "suggestion", schema: [], messages: { found: "{{ text }}" } },
      create(context) {
        return {
          JSXOpeningElement(node: OpeningElement) {
            const text = check(node, context);
            if (text) context.report({ node: node as never, messageId: "found", data: { text } });
          },
        };
      },
    },
  };
}

/** Input types with no kit equivalent that a plain <input> is the right tool for. */
const NON_TEXT_INPUT_TYPES = new Set(["file", "submit", "reset", "button", "image", "color", "hidden"]);

export default function rules(h: RuleHelpers): DetectorRule[] {
  const staticInputType = (node: OpeningElement): string | undefined => {
    const value = h.getAttr(node, "type")?.value;
    if (value?.type === "Literal") return String(value.value);
    if (value?.type === "JSXExpressionContainer" && value.expression?.type === "Literal") {
      return String(value.expression.value);
    }
    return undefined;
  };

  return [
    jsxRule(
      "segmented-from-buttons",
      "Segmented",
      "Buttons that switch their own `type` to show a selected state are a segmented control: use Segmented.",
      (node, context) => {
        const toggles = h
          .childElements(node)
          .filter((c) => h.isKitElement(context, c) && h.jsxName(c) === "Button" && h.attrExpressionType(c, "type") === "ConditionalExpression");
        return toggles.length >= 2
          ? "Buttons toggling their type to mark the active one are a hand-made segmented control. Use Segmented."
          : undefined;
      },
    ),
    jsxRule("raw-button", "Button", "Use Button instead of a raw <button> element.", (node) =>
      h.jsxName(node) === "button" ? "Use Button from antd instead of a raw <button> element." : undefined,
    ),
    jsxRule(
      "raw-form-control",
      "Input",
      "Use Input, Checkbox, Radio, InputNumber or Input.TextArea instead of raw form controls.",
      (node) => {
        const name = h.jsxName(node);
        if (name === "textarea") return "Use Input.TextArea from antd instead of a raw <textarea>.";
        if (name !== "input") return undefined;
        const type = staticInputType(node);
        if (type !== undefined && NON_TEXT_INPUT_TYPES.has(type)) return undefined;
        const target =
          type === "checkbox" ? "Checkbox" : type === "radio" ? "Radio" : type === "number" ? "InputNumber" : type === "range" ? "Slider" : "Input";
        return `Use ${target} from antd instead of a raw <input>.`;
      },
    ),
    jsxRule("raw-select", "Select", "Use Select instead of a raw <select> element.", (node) =>
      h.jsxName(node) === "select" ? "Use Select from antd instead of a raw <select> element." : undefined,
    ),
    jsxRule("raw-table", "Table", "Use Table instead of a raw <table> element.", (node) =>
      h.jsxName(node) === "table" ? "Use Table from antd instead of a raw <table> element." : undefined,
    ),
    jsxRule(
      "styled-card-div",
      "Card",
      "A div styled as a bordered or shadowed rounded box is a Card.",
      (node) => {
        if (h.jsxName(node) !== "div") return undefined;
        const keys = h.styleKeys(node);
        const border = h.styleLiteral(node, "border");
        const hasBorder = keys.includes("border") && border !== "none" && border !== 0;
        return keys.includes("borderRadius") && (keys.includes("boxShadow") || hasBorder)
          ? "A <div> styled as a rounded box with border or shadow is a Card. Use Card from antd."
          : undefined;
      },
    ),
  ];
}
