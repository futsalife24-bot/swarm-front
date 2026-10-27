export function roomAccessInfo(listed: boolean | undefined) {
  if (listed === true)
    return {
      state: "public",
      label: "フリーマッチング",
      detail: "部屋一覧に公開する設定です。満員時などは表示されません。",
    } as const;
  if (listed === false)
    return {
      state: "private",
      label: "パスワード付き",
      detail: "この部屋は一覧には表示されません。",
    } as const;
  return {
    state: "unknown",
    label: "募集方式不明",
    detail: "通信先から募集方式を確認できません。",
  } as const;
}
