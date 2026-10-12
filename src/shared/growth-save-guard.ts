/** Reject older-client overwrites which strip the additive growth fields. */
export function preservesGrowthSave(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
) {
  const a = previous.survival as Record<string, number> | undefined;
  const b = next.survival as Record<string, number> | undefined;
  if (
    a &&
    (!b || Object.keys(a).some((k) => !Number.isFinite(b[k]) || b[k] < a[k]))
  )
    return false;
  const oldReceipts = previous.receipts as string[] | undefined;
  const newReceipts = next.receipts as string[] | undefined;
  if (
    ![...(oldReceipts ?? []), ...(newReceipts ?? [])].every(
      (id) => typeof id === "string",
    )
  )
    return false;
  if (
    oldReceipts?.some(
      (id) => id.startsWith("front-survival:") && !newReceipts?.includes(id),
    )
  )
    return false;
  const weapons = (s: Record<string, unknown>) => [
    ...((s.inventory as Record<string, unknown>[]) ?? []),
    ...((s.pending as Record<string, unknown>[]) ?? []),
  ];
  if (
    ![...weapons(previous), ...weapons(next)].every(
      (w) => w && typeof w === "object" && typeof w.id === "string",
    )
  )
    return false;
  const oldWeapons = new Map(weapons(previous).map((w) => [w.id, w]));
  for (const w of weapons(next)) {
    const old = oldWeapons.get(w.id);
    if (!old) continue;
    if (old.level !== undefined && Number(w.level ?? 1) < Number(old.level))
      return false;
    const mods = old.mods as Record<string, number> | undefined;
    const nextMods = w.mods as Record<string, number> | undefined;
    if (
      mods &&
      Object.keys(mods).some((k) => Number(nextMods?.[k] ?? 0) < mods[k])
    )
      return false;
  }
  return true;
}
