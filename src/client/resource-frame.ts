import "./resource-frame.css";

const resources = {
  coins: {
    name: "コイン",
    icon: '<circle cx="16" cy="16" r="12"/><circle cx="16" cy="16" r="8"/><path d="M19 11h-5v10h5M11 14h8M11 18h8"/>',
  },
  powder: {
    name: "武装片",
    icon: '<path d="m5 8 10-4 4 8-7 8-8-3Zm15 8 7-3 2 10-9 5-5-5Z"/><path d="m8 10 5 4 3-5m5 11 4 3"/>',
  },
  materials: {
    name: "解放素材",
    icon: '<path d="m16 3 10 8v13l-10 5-10-5V11Z"/><path d="m6 11 10 5 10-5M16 16v13m-5-18 5-4 5 4"/>',
  },
  points: {
    name: "育成ポイント",
    icon: '<path d="m16 3 12 7v12l-12 7-12-7V10Z"/><path d="m10 17 6-7 6 7m-6-7v14"/>',
  },
} as const;

export type ResourceKind = keyof typeof resources;
export function resourceFrame(
  kind: ResourceKind,
  amount: number,
  purpose: "owned" | "gain" | "cost" | "used" = "owned",
): string {
  const item = resources[kind];
  const label = { owned: "所持", gain: "獲得", cost: "消費", used: "使用" }[
    purpose
  ];
  const number = Math.max(0, Math.trunc(amount)).toLocaleString("ja-JP");
  const description = `${item.name} ${label} ${number}`;
  const sign = purpose === "gain" ? "+" : purpose === "cost" ? "−" : "";
  return `<span class="resource-frame resource-${kind}" data-resource="${kind}" data-purpose="${purpose}" role="img" aria-label="${description}" title="${description}"><svg class="resource-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">${item.icon}</svg>${purpose === "used" ? `<span class="resource-purpose">${label}</span>` : ""}<strong class="resource-amount">${sign}${number}</strong></span>`;
}

export function resourceWallet(save: Record<ResourceKind, number>): string {
  return `<div class="resource-wallet" aria-label="所持アイテム">${(Object.keys(resources) as ResourceKind[]).map((kind) => resourceFrame(kind, save[kind])).join("")}</div>`;
}
