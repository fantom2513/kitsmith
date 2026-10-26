export const ladderFindSentence = () => `Call find_component before writing any UI element by hand.`;
export const ladderPropsSentence = () => `Check props with get_component instead of guessing.`;
export const ladderValidateSentence = () => `Run validate after editing UI files and fix what it reports.`;

export function renderLadder(kitName: string, allowedExternal: string[]): string {
  const allowed = allowedExternal.length > 0 ? allowedExternal.join(", ") : "none";
  return [
    `Build UI from the ${kitName} component kit. For every UI need, resolve in this order:`,
    `1. An existing ${kitName} component fits → use it. ${ladderFindSentence()}`,
    `2. Nothing fits → compose it from ${kitName} components. Call get_recipe for known compositions.`,
    `3. Still not covered → use an allowed external library: ${allowed}.`,
    `4. Only then write your own code, and say so in your reply.`,
    `${ladderPropsSentence()} ${ladderValidateSentence()}`,
  ].join("\n");
}
