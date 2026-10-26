import type { TokenExtractor } from "../../src/adapter/types.js";

const WANTED =
  /^(color(Primary|Success|Warning|Error|Info|Text|TextSecondary|Bg(Container|Layout)|Border)|fontFamily|fontSize(SM|LG|XL)?|lineHeight|borderRadius(SM|LG)?|controlHeight(SM|LG)?|padding(XS|SM|LG)?|margin(XS|SM|LG)?)$/;

const extractTokens: TokenExtractor = async ({ requireFromProject }) => {
  const antd = requireFromProject("antd") as { theme: { getDesignToken(): Record<string, unknown> } };
  const all = antd.theme.getDesignToken();
  return Object.fromEntries(Object.entries(all).filter(([key]) => WANTED.test(key)));
};

export default extractTokens;
