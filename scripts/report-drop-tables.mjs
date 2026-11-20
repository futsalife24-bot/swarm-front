import { createServer } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, watch: null },
  appType: "custom",
});
try {
  const p = await server.ssrLoadModule("/src/shared/progression.ts");
  const c = await server.ssrLoadModule("/src/shared/campaign.ts");
  const { STAGES } = await server.ssrLoadModule("/src/shared/stages.ts");
  const { SUPPLY_RULES } = await server.ssrLoadModule(
    "/src/shared/supply-policy.ts",
  );
  const survival = await server.ssrLoadModule("/src/shared/front-survival.ts");
  let seed = 1729;
  const rng = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const rows = c.SOLO_STAGE_IDS.flatMap((id) =>
    ["normal", "medium"].map((d) => ({
      id,
      stage: p.stageLabel(id),
      difficulty: d,
      rarity: p.rarityWeights(id, d),
      level: p.rollWeapon("report", id, d, false, 1, rng).level,
    })),
  );
  const coop = STAGES.map((s) => {
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 200000; i++) {
      let score = 0;
      for (let j = 0; j < 5; j++)
        score += Math.min(450, Math.floor(rng() ** s.lootExponent * 451)) / 450;
      score /= 5;
      const rarity = score >= 0.7 ? 2 : score >= 0.55 ? 1 : 0;
      counts[score >= 0.83 && rng() < 0.6 ? 3 : rarity]++;
    }
    return {
      stage: s.id,
      dropRate: s.dropRate,
      lootExponent: s.lootExponent,
      samples: 200000,
      quality: counts.map((n) => n / 200000),
    };
  });
  const result = {
    rows,
    variance: c.SOLO_STAGE_IDS.map((id) => ({
      id,
      bands: p.varianceWeights?.(id) ?? [0.2, 0.1, 0.57, 0.1, 0.03],
    })),
    supply: SUPPLY_RULES,
    soloDropRate: 0.05,
    soloWeaponCap: 3,
    survivalLevel: survival.frontSurvivalWeaponLevel(25),
    coop,
  };
  const target =
    process.argv[2] ?? "docs/evidence/gacha-balance-20261117/before.json";
  mkdirSync("docs/evidence/gacha-balance-20261117", { recursive: true });
  writeFileSync(target, JSON.stringify(result, null, 2) + "\n");
  console.log(`棚卸し保存: ${target} (${rows.length}行 / 協力25段×20万回)`);
} finally {
  await server.close();
}
