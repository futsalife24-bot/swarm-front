const sections = [
  {
    label: "各ページ",
    entries: [
      [
        "出撃準備",
        "ステージ・難易度・装備を選んで出撃します。まずは現在挑戦できるステージから始めましょう。",
      ],
      [
        "協力プレイ",
        "部屋を作るか、招待から参加して仲間と出撃します。協力プレイには通信が必要です。",
      ],
      [
        "基地",
        "武器の比較・整理、アクセサリの作成・装備・合成、兵士の育成を行います。工房は工事中です。",
      ],
      [
        "エネミーレポート",
        "敵の特徴と対処を確認できます。苦手な敵に出会ったら見直しましょう。",
      ],
      [
        "設定・操作",
        "操作方法や各種設定を確認・変更できます。自分に合う設定で遊びましょう。",
      ],
    ],
  },
  {
    label: "システム",
    entries: [
      [
        "武器と装備",
        "手に入れた武器の性能を比較し、出撃準備で装備を選びます。大切な武器はロックして保護できます。",
      ],
      [
        "戦利品と育成",
        "戦闘で得た報酬を確認し、基地で装備の整理や兵士の強化につなげましょう。",
      ],
      [
        "進行と保存",
        "戦利品はこの端末に保存されます。所持武器はソロと協力プレイで共通です。ソロは通信サーバーなしで遊べます。",
      ],
    ],
  },
  {
    label: "進め方",
    entries: [
      [
        "1. 出撃を準備",
        "タイトルの「ソロで出撃準備」から、ステージと装備を選びます。操作が気になるときは「設定・操作」を確認しましょう。",
      ],
      [
        "2. 戦場に挑戦",
        "出撃したら周囲の敵と状況を確認しながら戦います。敵への対処に迷ったら、タイトルのエネミーレポートが手がかりになります。",
      ],
      [
        "3. 報酬を確認",
        "戦闘が終わったら戦果を確認します。手に入れた武器を比べて、次の出撃に使う装備を選びましょう。",
      ],
      [
        "4. 基地で準備を整える",
        "武器の整理や育成をして、次のステージや難易度へ挑戦します。仲間と遊ぶときはタイトルの「協力プレイ」へ進みましょう。",
      ],
    ],
  },
];

/** Read-only title guide; opening it never initializes or changes progression. */
export function openTutorialGuide(
  openDialog: (title: string, content: string) => HTMLDialogElement,
) {
  const d = openDialog(
    "チュートリアル",
    sections
      .map(
        (section, i) =>
          `<section id="tutorial-panel-${i}" role="tabpanel" aria-labelledby="tutorial-tab-${i}" tabindex="0" ${i ? "hidden" : ""}><div class="tutorial-entries">${section.entries.map(([title, body]) => `<section><h3>${title}</h3><p>${body}</p></section>`).join("")}</div></section>`,
      )
      .join(""),
  );
  d.classList.add("tutorial-guide");
  const body = d.querySelector<HTMLElement>(".menu-dialog-body")!;
  const tabs = document.createElement("div");
  tabs.className = "tutorial-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "チュートリアルの項目");
  tabs.innerHTML = sections
    .map(
      (s, i) =>
        `<button type="button" id="tutorial-tab-${i}" role="tab" aria-controls="tutorial-panel-${i}" aria-selected="${i === 0}" tabindex="${i ? -1 : 0}">${s.label}</button>`,
    )
    .join("");
  body.before(tabs);
  const buttons = [...tabs.querySelectorAll<HTMLButtonElement>("button")];
  const select = (index: number) => {
    buttons.forEach((button, i) => {
      button.setAttribute("aria-selected", String(i === index));
      button.tabIndex = i === index ? 0 : -1;
      d.querySelector<HTMLElement>(`#tutorial-panel-${i}`)!.hidden =
        i !== index;
    });
    body.scrollTop = 0;
  };
  buttons.forEach((button, i) => {
    button.onclick = () => select(i);
    button.onkeydown = (event) => {
      const index =
        event.key === "ArrowRight"
          ? (i + 1) % buttons.length
          : event.key === "ArrowLeft"
            ? (i + buttons.length - 1) % buttons.length
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? buttons.length - 1
                : -1;
      if (index < 0) return;
      event.preventDefault();
      select(index);
      buttons[index].focus();
    };
  });
}
