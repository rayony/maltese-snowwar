/** How a vs-AI run is marked Cheat (not Fair).
 *  `runCheated` in the game is set if ANY of these fire during the campaign.
 */
export const CHEAT_REASONS = {
  star: {
    id: "star",
    label: "Star mode",
    how: "Tap the stage label 5 times. Faster pack/charge and extra HP.",
  },
  gold: {
    id: "gold",
    label: "Big-ball spawn",
    how: "Double-tap the X vs Y score HUD to spawn a gold orb.",
  },
  bot: {
    id: "bot",
    label: "AI bot detected / suspected",
    how: "Manual review — time or pattern looks automated, not a normal human clear.",
  },
} as const;

export type CheatReasonId = keyof typeof CHEAT_REASONS;

export function cheatRemark(reason: string | null | undefined) {
  const raw = (reason ?? "").trim();
  if (!raw) return "Cheat run (star mode or HUD gold spawn).";
  if (raw === CHEAT_REASONS.star.id || raw === CHEAT_REASONS.star.label) {
    return "Cheat · Star mode (stage label ×5)";
  }
  if (raw === CHEAT_REASONS.gold.id || raw === CHEAT_REASONS.gold.label) {
    return "Cheat · Big-ball spawn (X vs Y ×2)";
  }
  if (raw.toLowerCase().includes("bot") || raw === CHEAT_REASONS.bot.id) {
    return "Cheat · AI bot detected / suspected";
  }
  return `Cheat · ${raw}`;
}
