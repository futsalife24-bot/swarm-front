// 生成ファイル（tools/build-data.mjs）。手で編集しない。出典: src/shared/front-upgrades.ts, src/client/front-upgrade-ui.ts, src/client/front-campaign.ts
window.SURVIVAL_CARD_DATA = {
 "source": "src/shared/front-upgrades.ts, src/client/front-upgrade-ui.ts, src/client/front-campaign.ts",
 "limits": {
  "maxTypes": 6,
  "minPool": 6,
  "rerolls": 2
 },
 "baseIds": [
  "blast-core",
  "fuse",
  "compressed-charge",
  "armor-piercer",
  "ricochet",
  "line-shot",
  "afterimage-mine",
  "tactical-reload",
  "interceptor",
  "armor",
  "reload",
  "magazine",
  "magnet",
  "blast-radius",
  "opening-shot",
  "emergency-armor",
  "life-drain",
  "power-cell",
  "reserve-rounds",
  "boost-coil",
  "recovery-pack",
  "burst-cell"
 ],
 "fusionIds": [
  "fusion-collapse",
  "fusion-skewer",
  "fusion-counter",
  "fusion-bastion",
  "fusion-magazine",
  "fusion-overdrive",
  "fusion-aegis",
  "fusion-collector",
  "fusion-reactor"
 ],
 "cards": [
  {
   "id": "blast-core",
   "name": "誘爆核",
   "catalogDescription": "手動射撃で撃破すると小爆発。導火を持つと爆発で印も付ける。",
   "family": "explosion",
   "familyLabel": "爆発",
   "maxLevel": 3,
   "fusion": false,
   "materials": [],
   "unlockStage": null,
   "icon": {
    "kind": "image",
    "file": "blast-core.png"
   },
   "effectByLevel": [
    "射撃撃破で爆発。爆発威力 42。",
    "射撃撃破で爆発。爆発威力 55。",
    "射撃撃破で爆発。爆発威力 67。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "新規獲得",
     "rank": "未取得 → 1段階",
     "description": "射撃撃破で爆発。爆発威力 42。"
    },
    {
     "owned": 1,
     "status": "段階アップ",
     "rank": "1 → 2段階",
     "description": "射撃撃破で爆発。爆発威力 55。"
    },
    {
     "owned": 2,
     "status": "段階アップ",
     "rank": "2 → 3段階",
     "description": "射撃撃破で爆発。爆発威力 67。"
    }
   ]
  },
  {
   "id": "fuse",
   "name": "導火",
   "catalogDescription": "手動命中で印を付け、次の手動命中で印を消費して起爆。",
   "family": "explosion",
   "familyLabel": "爆発",
   "maxLevel": 3,
   "fusion": false,
   "materials": [],
   "unlockStage": null,
   "icon": {
    "kind": "image",
    "file": "fuse.png"
   },
   "effectByLevel": [
    "命中で印、次の命中で起爆。威力 34。",
    "命中で印、次の命中で起爆。威力 44。",
    "命中で印、次の命中で起爆。威力 54。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "新規獲得",
     "rank": "未取得 → 1段階",
     "description": "命中で印、次の命中で起爆。威力 34。"
    },
    {
     "owned": 1,
     "status": "段階アップ",
     "rank": "1 → 2段階",
     "description": "命中で印、次の命中で起爆。威力 44。"
    },
    {
     "owned": 2,
     "status": "段階アップ",
     "rank": "2 → 3段階",
     "description": "命中で印、次の命中で起爆。威力 54。"
    }
   ]
  },
  {
   "id": "compressed-charge",
   "name": "圧縮炸薬",
   "catalogDescription": "同じ敵へ3回の手動命中で小爆発。他の爆発と重なる場合は半径を拡張。",
   "family": "explosion",
   "familyLabel": "爆発",
   "maxLevel": 3,
   "fusion": false,
   "materials": [],
   "unlockStage": null,
   "icon": {
    "kind": "image",
    "file": "compressed-charge.png"
   },
   "effectByLevel": [
    "同じ敵に3回命中で爆発。威力 42。",
    "同じ敵に3回命中で爆発。威力 55。",
    "同じ敵に2回命中で爆発。威力 67。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "新規獲得",
     "rank": "未取得 → 1段階",
     "description": "同じ敵に3回命中で爆発。威力 42。"
    },
    {
     "owned": 1,
     "status": "段階アップ",
     "rank": "1 → 2段階",
     "description": "同じ敵に3回命中で爆発。威力 55。"
    },
    {
     "owned": 2,
     "status": "段階アップ",
     "rank": "2 → 3段階",
     "description": "同じ敵に2回命中で爆発。威力 67。"
    }
   ]
  },
  {
   "id": "armor-piercer",
   "name": "徹甲芯",
   "catalogDescription": "手動弾の貫通対象を1体追加。",
   "family": "piercing",
   "familyLabel": "貫通",
   "maxLevel": 3,
   "fusion": false,
   "materials": [],
   "unlockStage": null,
   "icon": {
    "kind": "image",
    "file": "armor-piercer.png"
   },
   "effectByLevel": [
    "貫通対象 +1体。",
    "貫通対象 +2体。",
    "貫通対象 +3体。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "新規獲得",
     "rank": "未取得 → 1段階",
     "description": "貫通対象 +1体。"
    },
    {
     "owned": 1,
     "status": "段階アップ",
     "rank": "1 → 2段階",
     "description": "貫通対象 +2体。"
    },
    {
     "owned": 2,
     "status": "段階アップ",
     "rank": "2 → 3段階",
     "description": "貫通対象 +3体。"
    }
   ]
  },
  {
   "id": "ricochet",
   "name": "反射弾",
   "catalogDescription": "同じ敵へ3回の手動命中で、近くの別対象へ1回跳弾。",
   "family": "piercing",
   "familyLabel": "貫通",
   "maxLevel": 3,
   "fusion": false,
   "materials": [],
   "unlockStage": null,
   "icon": {
    "kind": "image",
    "file": "ricochet.png"
   },
   "effectByLevel": [
    "3回命中で跳弾。威力 32。",
    "3回命中で跳弾。威力 45。",
    "3回命中で跳弾。威力 58。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "新規獲得",
     "rank": "未取得 → 1段階",
     "description": "3回命中で跳弾。威力 32。"
    },
    {
     "owned": 1,
     "status": "段階アップ",
     "rank": "1 → 2段階",
     "description": "3回命中で跳弾。威力 45。"
    },
    {
     "owned": 2,
     "status": "段階アップ",
     "rank": "2 → 3段階",
     "description": "3回命中で跳弾。威力 58。"
    }
   ]
  },
  {
   "id": "line-shot",
   "name": "整列射",
   "catalogDescription": "貫通対象+1。1発で3体以上に当てると弾倉へ1発返す。",
   "family": "piercing",
   "familyLabel": "貫通",
   "maxLevel": 3,
   "fusion": false,
   "materials": [],
   "unlockStage": null,
   "icon": {
    "kind": "image",
    "file": "line-shot.png"
   },
   "effectByLevel": [
    "貫通 +1体。3体命中で1発返却。",
    "貫通 +2体。3体命中で2発返却。",
    "貫通 +3体。3体命中で3発返却。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "新規獲得",
     "rank": "未取得 → 1段階",
     "description": "貫通 +1体。3体命中で1発返却。"
    },
    {
     "owned": 1,
     "status": "段階アップ",
     "rank": "1 → 2段階",
     "description": "貫通 +2体。3体命中で2発返却。"
    },
    {
     "owned": 2,
     "status": "段階アップ",
     "rank": "2 → 3段階",
     "description": "貫通 +3体。3体命中で3発返却。"
    }
   ]
  },
  {
   "id": "afterimage-mine",
   "name": "残像地雷",
   "catalogDescription": "回避終了地点に地雷。最大3個、4個目は最古を置換。",
   "family": "interception",
   "familyLabel": "迎撃",
   "maxLevel": 3,
   "fusion": false,
   "materials": [],
   "unlockStage": null,
   "icon": {
    "kind": "image",
    "file": "afterimage-mine.png"
   },
   "effectByLevel": [
    "回避後に地雷。最大3個・威力 65。",
    "回避後に地雷。最大4個・威力 85。",
    "回避後に地雷。最大5個・威力 104。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "新規獲得",
     "rank": "未取得 → 1段階",
     "description": "回避後に地雷。最大3個・威力 65。"
    },
    {
     "owned": 1,
     "status": "段階アップ",
     "rank": "1 → 2段階",
     "description": "回避後に地雷。最大4個・威力 85。"
    },
    {
     "owned": 2,
     "status": "段階アップ",
     "rank": "2 → 3段階",
     "description": "回避後に地雷。最大5個・威力 104。"
    }
   ]
  },
  {
   "id": "tactical-reload",
   "name": "戦術装填",
   "catalogDescription": "回避後の次の装填を短縮。",
   "family": "interception",
   "familyLabel": "迎撃",
   "maxLevel": 3,
   "fusion": false,
   "materials": [],
   "unlockStage": null,
   "icon": {
    "kind": "image",
    "file": "tactical-reload.png"
   },
   "effectByLevel": [
    "回避後、次の装填時間 −35%。",
    "回避後、次の装填時間 −45%。",
    "回避後、次の装填時間 −55%。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "新規獲得",
     "rank": "未取得 → 1段階",
     "description": "回避後、次の装填時間 −35%。"
    },
    {
     "owned": 1,
     "status": "段階アップ",
     "rank": "1 → 2段階",
     "description": "回避後、次の装填時間 −45%。"
    },
    {
     "owned": 2,
     "status": "段階アップ",
     "rank": "2 → 3段階",
     "description": "回避後、次の装填時間 −55%。"
    }
   ]
  },
  {
   "id": "interceptor",
   "name": "迎撃子機",
   "catalogDescription": "手動命中で充填。弾を消費した装填中に短い迎撃を1回。",
   "family": "interception",
   "familyLabel": "迎撃",
   "maxLevel": 3,
   "fusion": false,
   "materials": [],
   "unlockStage": null,
   "icon": {
    "kind": "image",
    "file": "interceptor.png"
   },
   "effectByLevel": [
    "命中で充填、装填時に迎撃。威力 35。",
    "命中で充填、装填時に迎撃。威力 49。",
    "命中で充填、装填時に迎撃。威力 63。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "新規獲得",
     "rank": "未取得 → 1段階",
     "description": "命中で充填、装填時に迎撃。威力 35。"
    },
    {
     "owned": 1,
     "status": "段階アップ",
     "rank": "1 → 2段階",
     "description": "命中で充填、装填時に迎撃。威力 49。"
    },
    {
     "owned": 2,
     "status": "段階アップ",
     "rank": "2 → 3段階",
     "description": "命中で充填、装填時に迎撃。威力 63。"
    }
   ]
  },
  {
   "id": "armor",
   "name": "装甲補強",
   "catalogDescription": "最大HPを基準値の5%追加。生存中は増加分だけ現在HPも回復。最大4段階。",
   "family": "generic",
   "familyLabel": "補強",
   "maxLevel": 4,
   "fusion": false,
   "materials": [],
   "unlockStage": null,
   "icon": {
    "kind": "image",
    "file": "armor.png"
   },
   "effectByLevel": [
    "最大体力 +5%。生存中の取得時は増加分を回復。",
    "最大体力 +10%。生存中の取得時は増加分を回復。",
    "最大体力 +15%。生存中の取得時は増加分を回復。",
    "最大体力 +20%。生存中の取得時は増加分を回復。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "新規獲得",
     "rank": "未取得 → 1段階",
     "description": "最大体力 +5%。生存中の取得時は増加分を回復。"
    },
    {
     "owned": 1,
     "status": "段階アップ",
     "rank": "1 → 2段階",
     "description": "最大体力 +10%。生存中の取得時は増加分を回復。"
    },
    {
     "owned": 2,
     "status": "段階アップ",
     "rank": "2 → 3段階",
     "description": "最大体力 +15%。生存中の取得時は増加分を回復。"
    },
    {
     "owned": 3,
     "status": "段階アップ",
     "rank": "3 → 4段階",
     "description": "最大体力 +20%。生存中の取得時は増加分を回復。"
    }
   ]
  },
  {
   "id": "reload",
   "name": "整備手順",
   "catalogDescription": "装填時間を基準値から5%短縮。最大4段階で20%短縮。",
   "family": "generic",
   "familyLabel": "補強",
   "maxLevel": 4,
   "fusion": false,
   "materials": [],
   "unlockStage": null,
   "icon": {
    "kind": "image",
    "file": "reload.png"
   },
   "effectByLevel": [
    "装填時間を基準値から5%短縮。",
    "装填時間を基準値から10%短縮。",
    "装填時間を基準値から15%短縮。",
    "装填時間を基準値から20%短縮。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "新規獲得",
     "rank": "未取得 → 1段階",
     "description": "装填時間を基準値から5%短縮。"
    },
    {
     "owned": 1,
     "status": "段階アップ",
     "rank": "1 → 2段階",
     "description": "装填時間を基準値から10%短縮。"
    },
    {
     "owned": 2,
     "status": "段階アップ",
     "rank": "2 → 3段階",
     "description": "装填時間を基準値から15%短縮。"
    },
    {
     "owned": 3,
     "status": "段階アップ",
     "rank": "3 → 4段階",
     "description": "装填時間を基準値から20%短縮。"
    }
   ]
  },
  {
   "id": "magazine",
   "name": "拡張弾倉",
   "catalogDescription": "基準弾倉の10%を切り上げた固定量を追加（最低1発）。最大4段階。",
   "family": "generic",
   "familyLabel": "補強",
   "maxLevel": 4,
   "fusion": false,
   "materials": [],
   "unlockStage": null,
   "icon": {
    "kind": "image",
    "file": "magazine.png"
   },
   "effectByLevel": [
    "基準弾倉の10%切上げ（最低1発）を1回分追加。",
    "基準弾倉の10%切上げ（最低1発）を2回分追加。",
    "基準弾倉の10%切上げ（最低1発）を3回分追加。",
    "基準弾倉の10%切上げ（最低1発）を4回分追加。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "新規獲得",
     "rank": "未取得 → 1段階",
     "description": "基準弾倉の10%切上げ（最低1発）を1回分追加。"
    },
    {
     "owned": 1,
     "status": "段階アップ",
     "rank": "1 → 2段階",
     "description": "基準弾倉の10%切上げ（最低1発）を2回分追加。"
    },
    {
     "owned": 2,
     "status": "段階アップ",
     "rank": "2 → 3段階",
     "description": "基準弾倉の10%切上げ（最低1発）を3回分追加。"
    },
    {
     "owned": 3,
     "status": "段階アップ",
     "rank": "3 → 4段階",
     "description": "基準弾倉の10%切上げ（最低1発）を4回分追加。"
    }
   ]
  },
  {
   "id": "magnet",
   "name": "磁力回収",
   "catalogDescription": "経験値の回収半径を段階ごとに3m追加。",
   "family": "generic",
   "familyLabel": "補強",
   "maxLevel": 3,
   "fusion": false,
   "materials": [],
   "unlockStage": null,
   "icon": {
    "kind": "image",
    "file": "magnet.png"
   },
   "effectByLevel": [
    "経験値の回収半径 8m。",
    "経験値の回収半径 11m。",
    "経験値の回収半径 14m。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "新規獲得",
     "rank": "未取得 → 1段階",
     "description": "経験値の回収半径 8m。"
    },
    {
     "owned": 1,
     "status": "段階アップ",
     "rank": "1 → 2段階",
     "description": "経験値の回収半径 11m。"
    },
    {
     "owned": 2,
     "status": "段階アップ",
     "rank": "2 → 3段階",
     "description": "経験値の回収半径 14m。"
    }
   ]
  },
  {
   "id": "blast-radius",
   "name": "爆域拡張",
   "catalogDescription": "爆発・地雷の半径を段階ごとに20%拡張。",
   "family": "generic",
   "familyLabel": "補強",
   "maxLevel": 3,
   "fusion": false,
   "materials": [],
   "unlockStage": null,
   "icon": {
    "kind": "image",
    "file": "blast-radius.png"
   },
   "effectByLevel": [
    "爆発・地雷の半径 +20%。",
    "爆発・地雷の半径 +40%。",
    "爆発・地雷の半径 +60%。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "新規獲得",
     "rank": "未取得 → 1段階",
     "description": "爆発・地雷の半径 +20%。"
    },
    {
     "owned": 1,
     "status": "段階アップ",
     "rank": "1 → 2段階",
     "description": "爆発・地雷の半径 +40%。"
    },
    {
     "owned": 2,
     "status": "段階アップ",
     "rank": "2 → 3段階",
     "description": "爆発・地雷の半径 +60%。"
    }
   ]
  },
  {
   "id": "opening-shot",
   "name": "装填初撃",
   "catalogDescription": "装填を完了した武器の初弾威力を段階ごとに25%強化。",
   "family": "generic",
   "familyLabel": "補強",
   "maxLevel": 3,
   "fusion": false,
   "materials": [],
   "unlockStage": null,
   "icon": {
    "kind": "image",
    "file": "opening-shot.png"
   },
   "effectByLevel": [
    "装填完了後、その武器の初弾威力 +25%。",
    "装填完了後、その武器の初弾威力 +50%。",
    "装填完了後、その武器の初弾威力 +75%。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "新規獲得",
     "rank": "未取得 → 1段階",
     "description": "装填完了後、その武器の初弾威力 +25%。"
    },
    {
     "owned": 1,
     "status": "段階アップ",
     "rank": "1 → 2段階",
     "description": "装填完了後、その武器の初弾威力 +50%。"
    },
    {
     "owned": 2,
     "status": "段階アップ",
     "rank": "2 → 3段階",
     "description": "装填完了後、その武器の初弾威力 +75%。"
    }
   ]
  },
  {
   "id": "emergency-armor",
   "name": "緊急装甲",
   "catalogDescription": "回避終了後2秒、被ダメージを段階ごとに10%軽減。",
   "family": "generic",
   "familyLabel": "補強",
   "maxLevel": 3,
   "fusion": false,
   "materials": [],
   "unlockStage": null,
   "icon": {
    "kind": "image",
    "file": "emergency-armor.png"
   },
   "effectByLevel": [
    "回避終了後2秒、被ダメージ −10%。",
    "回避終了後2秒、被ダメージ −20%。",
    "回避終了後2秒、被ダメージ −30%。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "新規獲得",
     "rank": "未取得 → 1段階",
     "description": "回避終了後2秒、被ダメージ −10%。"
    },
    {
     "owned": 1,
     "status": "段階アップ",
     "rank": "1 → 2段階",
     "description": "回避終了後2秒、被ダメージ −20%。"
    },
    {
     "owned": 2,
     "status": "段階アップ",
     "rank": "2 → 3段階",
     "description": "回避終了後2秒、被ダメージ −30%。"
    }
   ]
  },
  {
   "id": "life-drain",
   "name": "生命回収",
   "catalogDescription": "撃破時に段階ごと1HP回復。",
   "family": "generic",
   "familyLabel": "補強",
   "maxLevel": 3,
   "fusion": false,
   "materials": [],
   "unlockStage": 2,
   "icon": {
    "kind": "atlas",
    "file": "fusion-atlas.png",
    "index": 0
   },
   "effectByLevel": [
    "撃破時に1HP回復。",
    "撃破時に2HP回復。",
    "撃破時に3HP回復。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "新規獲得",
     "rank": "未取得 → 1段階",
     "description": "撃破時に1HP回復。"
    },
    {
     "owned": 1,
     "status": "段階アップ",
     "rank": "1 → 2段階",
     "description": "撃破時に2HP回復。"
    },
    {
     "owned": 2,
     "status": "段階アップ",
     "rank": "2 → 3段階",
     "description": "撃破時に3HP回復。"
    }
   ]
  },
  {
   "id": "power-cell",
   "name": "出力増幅",
   "catalogDescription": "手動射撃の威力を段階ごと10%増加。",
   "family": "generic",
   "familyLabel": "補強",
   "maxLevel": 3,
   "fusion": false,
   "materials": [],
   "unlockStage": 4,
   "icon": {
    "kind": "atlas",
    "file": "fusion-atlas.png",
    "index": 1
   },
   "effectByLevel": [
    "手動射撃の威力 +10%。",
    "手動射撃の威力 +20%。",
    "手動射撃の威力 +30%。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "新規獲得",
     "rank": "未取得 → 1段階",
     "description": "手動射撃の威力 +10%。"
    },
    {
     "owned": 1,
     "status": "段階アップ",
     "rank": "1 → 2段階",
     "description": "手動射撃の威力 +20%。"
    },
    {
     "owned": 2,
     "status": "段階アップ",
     "rank": "2 → 3段階",
     "description": "手動射撃の威力 +30%。"
    }
   ]
  },
  {
   "id": "reserve-rounds",
   "name": "弾薬循環",
   "catalogDescription": "手動射撃で撃破時、段階ごと1発を弾倉へ返却。",
   "family": "generic",
   "familyLabel": "補強",
   "maxLevel": 3,
   "fusion": false,
   "materials": [],
   "unlockStage": 6,
   "icon": {
    "kind": "atlas",
    "file": "fusion-atlas.png",
    "index": 2
   },
   "effectByLevel": [
    "手動射撃で撃破時、弾倉に1発返却。",
    "手動射撃で撃破時、弾倉に2発返却。",
    "手動射撃で撃破時、弾倉に3発返却。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "新規獲得",
     "rank": "未取得 → 1段階",
     "description": "手動射撃で撃破時、弾倉に1発返却。"
    },
    {
     "owned": 1,
     "status": "段階アップ",
     "rank": "1 → 2段階",
     "description": "手動射撃で撃破時、弾倉に2発返却。"
    },
    {
     "owned": 2,
     "status": "段階アップ",
     "rank": "2 → 3段階",
     "description": "手動射撃で撃破時、弾倉に3発返却。"
    }
   ]
  },
  {
   "id": "boost-coil",
   "name": "回避促進",
   "catalogDescription": "回避の待ち時間を段階ごと8%短縮。",
   "family": "generic",
   "familyLabel": "補強",
   "maxLevel": 3,
   "fusion": false,
   "materials": [],
   "unlockStage": 1,
   "icon": {
    "kind": "image",
    "file": "boost-coil.png"
   },
   "effectByLevel": [
    "回避の待ち時間 −8%。",
    "回避の待ち時間 −16%。",
    "回避の待ち時間 −24%。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "新規獲得",
     "rank": "未取得 → 1段階",
     "description": "回避の待ち時間 −8%。"
    },
    {
     "owned": 1,
     "status": "段階アップ",
     "rank": "1 → 2段階",
     "description": "回避の待ち時間 −16%。"
    },
    {
     "owned": 2,
     "status": "段階アップ",
     "rank": "2 → 3段階",
     "description": "回避の待ち時間 −24%。"
    }
   ]
  },
  {
   "id": "recovery-pack",
   "name": "回収治癒",
   "catalogDescription": "経験値を拾うと段階ごと1HP回復。3秒に1回。",
   "family": "generic",
   "familyLabel": "補強",
   "maxLevel": 3,
   "fusion": false,
   "materials": [],
   "unlockStage": 3,
   "icon": {
    "kind": "image",
    "file": "recovery-pack.png"
   },
   "effectByLevel": [
    "経験値を拾うと1HP回復。3秒に1回。",
    "経験値を拾うと2HP回復。3秒に1回。",
    "経験値を拾うと3HP回復。3秒に1回。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "新規獲得",
     "rank": "未取得 → 1段階",
     "description": "経験値を拾うと1HP回復。3秒に1回。"
    },
    {
     "owned": 1,
     "status": "段階アップ",
     "rank": "1 → 2段階",
     "description": "経験値を拾うと2HP回復。3秒に1回。"
    },
    {
     "owned": 2,
     "status": "段階アップ",
     "rank": "2 → 3段階",
     "description": "経験値を拾うと3HP回復。3秒に1回。"
    }
   ]
  },
  {
   "id": "burst-cell",
   "name": "爆圧増幅",
   "catalogDescription": "爆発・地雷の威力を段階ごと8%増加。",
   "family": "generic",
   "familyLabel": "補強",
   "maxLevel": 3,
   "fusion": false,
   "materials": [],
   "unlockStage": 5,
   "icon": {
    "kind": "image",
    "file": "burst-cell.png"
   },
   "effectByLevel": [
    "爆発・地雷の威力 +8%。",
    "爆発・地雷の威力 +16%。",
    "爆発・地雷の威力 +24%。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "新規獲得",
     "rank": "未取得 → 1段階",
     "description": "爆発・地雷の威力 +8%。"
    },
    {
     "owned": 1,
     "status": "段階アップ",
     "rank": "1 → 2段階",
     "description": "爆発・地雷の威力 +16%。"
    },
    {
     "owned": 2,
     "status": "段階アップ",
     "rank": "2 → 3段階",
     "description": "爆発・地雷の威力 +24%。"
    }
   ]
  },
  {
   "id": "fusion-collapse",
   "name": "チェインノヴァ",
   "catalogDescription": "導火と爆域拡張を継承。印の爆発が連鎖する。",
   "family": "explosion",
   "familyLabel": "爆発",
   "maxLevel": 3,
   "fusion": true,
   "materials": [
    "fuse",
    "blast-radius"
   ],
   "unlockStage": null,
   "icon": {
    "kind": "atlas",
    "file": "fusion-atlas.png",
    "index": 3
   },
   "effectByLevel": [
    "印の爆発が、近くの印へ連鎖する。 導火：命中で印、次の命中で起爆。威力 65。 爆域拡張：爆発・地雷の半径 +80%。",
    "印の爆発が、近くの印へ連鎖する。 導火：命中で印、次の命中で起爆。威力 75。 爆域拡張：爆発・地雷の半径 +100%。",
    "印の爆発が、近くの印へ連鎖する。 導火：命中で印、次の命中で起爆。威力 85。 爆域拡張：爆発・地雷の半径 +120%。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "融合進化",
     "rank": "2枠 → 1枠 · 1段階",
     "description": "印の爆発が、近くの印へ連鎖する。"
    },
    {
     "owned": 1,
     "status": "融合強化",
     "rank": "1 → 2段階",
     "description": "印の爆発が、近くの印へ連鎖する。"
    },
    {
     "owned": 2,
     "status": "融合強化",
     "rank": "2 → 3段階",
     "description": "印の爆発が、近くの印へ連鎖する。"
    }
   ]
  },
  {
   "id": "fusion-skewer",
   "name": "リフレクトバースト",
   "catalogDescription": "反射弾と装填初撃を継承。跳弾撃破で次弾を増幅。",
   "family": "piercing",
   "familyLabel": "貫通",
   "maxLevel": 3,
   "fusion": true,
   "materials": [
    "ricochet",
    "opening-shot"
   ],
   "unlockStage": null,
   "icon": {
    "kind": "atlas",
    "file": "fusion-atlas.png",
    "index": 4
   },
   "effectByLevel": [
    "跳弾で倒すと、次の一発の威力と貫通がアップ。 反射弾：3回命中で跳弾。威力 70。 装填初撃：装填完了後、その武器の初弾威力 +100%。",
    "跳弾で倒すと、次の一発の威力と貫通がアップ。 反射弾：3回命中で跳弾。威力 83。 装填初撃：装填完了後、その武器の初弾威力 +125%。",
    "跳弾で倒すと、次の一発の威力と貫通がアップ。 反射弾：3回命中で跳弾。威力 96。 装填初撃：装填完了後、その武器の初弾威力 +150%。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "融合進化",
     "rank": "2枠 → 1枠 · 1段階",
     "description": "跳弾で倒すと、次の一発の威力と貫通がアップ。"
    },
    {
     "owned": 1,
     "status": "融合強化",
     "rank": "1 → 2段階",
     "description": "跳弾で倒すと、次の一発の威力と貫通がアップ。"
    },
    {
     "owned": 2,
     "status": "融合強化",
     "rank": "2 → 3段階",
     "description": "跳弾で倒すと、次の一発の威力と貫通がアップ。"
    }
   ]
  },
  {
   "id": "fusion-counter",
   "name": "ミラージュガード",
   "catalogDescription": "残像地雷と迎撃子機を継承。地雷後の命中で迎撃。",
   "family": "interception",
   "familyLabel": "迎撃",
   "maxLevel": 3,
   "fusion": true,
   "materials": [
    "afterimage-mine",
    "interceptor"
   ],
   "unlockStage": null,
   "icon": {
    "kind": "atlas",
    "file": "fusion-atlas.png",
    "index": 5
   },
   "effectByLevel": [
    "地雷が爆発すると、次の命中に追撃弾。 残像地雷：回避後に地雷。最大6個・威力 124。 迎撃子機：命中で充填、装填時に迎撃。威力 77。",
    "地雷が爆発すると、次の命中に追撃弾。 残像地雷：回避後に地雷。最大7個・威力 143。 迎撃子機：命中で充填、装填時に迎撃。威力 91。",
    "地雷が爆発すると、次の命中に追撃弾。 残像地雷：回避後に地雷。最大8個・威力 163。 迎撃子機：命中で充填、装填時に迎撃。威力 105。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "融合進化",
     "rank": "2枠 → 1枠 · 1段階",
     "description": "地雷が爆発すると、次の命中に追撃弾。"
    },
    {
     "owned": 1,
     "status": "融合強化",
     "rank": "1 → 2段階",
     "description": "地雷が爆発すると、次の命中に追撃弾。"
    },
    {
     "owned": 2,
     "status": "融合強化",
     "rank": "2 → 3段階",
     "description": "地雷が爆発すると、次の命中に追撃弾。"
    }
   ]
  },
  {
   "id": "fusion-bastion",
   "name": "リジェネアーマー",
   "catalogDescription": "装甲補強と生命回収を継承。最大体力と撃破回復を追加。",
   "family": "generic",
   "familyLabel": "補強",
   "maxLevel": 3,
   "fusion": true,
   "materials": [
    "armor",
    "life-drain"
   ],
   "unlockStage": null,
   "icon": {
    "kind": "atlas",
    "file": "fusion-atlas.png",
    "index": 6
   },
   "effectByLevel": [
    "敵を倒すたび体力4回復。最大体力も25%アップ。 装甲補強：最大体力 +25%。生存中の取得時は増加分を回復。 生命回収：撃破時に4HP回復。",
    "敵を倒すたび体力5回復。最大体力も30%アップ。 装甲補強：最大体力 +30%。生存中の取得時は増加分を回復。 生命回収：撃破時に5HP回復。",
    "敵を倒すたび体力6回復。最大体力も35%アップ。 装甲補強：最大体力 +35%。生存中の取得時は増加分を回復。 生命回収：撃破時に6HP回復。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "融合進化",
     "rank": "2枠 → 1枠 · 1段階",
     "description": "敵を倒すたび体力4回復。最大体力も25%アップ。"
    },
    {
     "owned": 1,
     "status": "融合強化",
     "rank": "1 → 2段階",
     "description": "敵を倒すたび体力5回復。最大体力も30%アップ。"
    },
    {
     "owned": 2,
     "status": "融合強化",
     "rank": "2 → 3段階",
     "description": "敵を倒すたび体力6回復。最大体力も35%アップ。"
    }
   ]
  },
  {
   "id": "fusion-magazine",
   "name": "ラピッドマガジン",
   "catalogDescription": "整備手順と拡張弾倉を継承。弾倉と装填速度をさらに強化。",
   "family": "generic",
   "familyLabel": "補強",
   "maxLevel": 3,
   "fusion": true,
   "materials": [
    "reload",
    "magazine"
   ],
   "unlockStage": null,
   "icon": {
    "kind": "atlas",
    "file": "fusion-atlas.png",
    "index": 7
   },
   "effectByLevel": [
    "装填を25%短縮。弾倉容量も大幅アップ。 整備手順：装填時間を基準値から25%短縮。 拡張弾倉：基準弾倉の10%切上げ（最低1発）を5回分追加。",
    "装填を30%短縮。弾倉容量も大幅アップ。 整備手順：装填時間を基準値から30%短縮。 拡張弾倉：基準弾倉の10%切上げ（最低1発）を6回分追加。",
    "装填を35%短縮。弾倉容量も大幅アップ。 整備手順：装填時間を基準値から35%短縮。 拡張弾倉：基準弾倉の10%切上げ（最低1発）を7回分追加。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "融合進化",
     "rank": "2枠 → 1枠 · 1段階",
     "description": "装填を25%短縮。弾倉容量も大幅アップ。"
    },
    {
     "owned": 1,
     "status": "融合強化",
     "rank": "1 → 2段階",
     "description": "装填を30%短縮。弾倉容量も大幅アップ。"
    },
    {
     "owned": 2,
     "status": "融合強化",
     "rank": "2 → 3段階",
     "description": "装填を35%短縮。弾倉容量も大幅アップ。"
    }
   ]
  },
  {
   "id": "fusion-overdrive",
   "name": "オーバードライブ",
   "catalogDescription": "出力増幅と弾薬循環を継承。威力と弾薬返却を追加。",
   "family": "generic",
   "familyLabel": "補強",
   "maxLevel": 3,
   "fusion": true,
   "materials": [
    "power-cell",
    "reserve-rounds"
   ],
   "unlockStage": null,
   "icon": {
    "kind": "atlas",
    "file": "fusion-atlas.png",
    "index": 8
   },
   "effectByLevel": [
    "射撃の威力40%アップ。倒すたび4発補充。 出力増幅：手動射撃の威力 +40%。 弾薬循環：手動射撃で撃破時、弾倉に4発返却。",
    "射撃の威力50%アップ。倒すたび5発補充。 出力増幅：手動射撃の威力 +50%。 弾薬循環：手動射撃で撃破時、弾倉に5発返却。",
    "射撃の威力60%アップ。倒すたび6発補充。 出力増幅：手動射撃の威力 +60%。 弾薬循環：手動射撃で撃破時、弾倉に6発返却。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "融合進化",
     "rank": "2枠 → 1枠 · 1段階",
     "description": "射撃の威力40%アップ。倒すたび4発補充。"
    },
    {
     "owned": 1,
     "status": "融合強化",
     "rank": "1 → 2段階",
     "description": "射撃の威力50%アップ。倒すたび5発補充。"
    },
    {
     "owned": 2,
     "status": "融合強化",
     "rank": "2 → 3段階",
     "description": "射撃の威力60%アップ。倒すたび6発補充。"
    }
   ]
  },
  {
   "id": "fusion-aegis",
   "name": "イージスブースト",
   "catalogDescription": "回避の回転率と軽減を継承し、回避後の防御時間も延長。",
   "family": "generic",
   "familyLabel": "補強",
   "maxLevel": 3,
   "fusion": true,
   "materials": [
    "boost-coil",
    "emergency-armor"
   ],
   "unlockStage": null,
   "icon": {
    "kind": "image",
    "file": "fusion-aegis.png"
   },
   "effectByLevel": [
    "回避後の防御を2.5秒に延長。回避も速く回せる。 回避促進：回避の待ち時間 −32%。 緊急装甲：2.5秒、被ダメージ −40%。",
    "回避後の防御を3秒に延長。回避も速く回せる。 回避促進：回避の待ち時間 −40%。 緊急装甲：3秒、被ダメージ −50%。",
    "回避後の防御を3.5秒に延長。回避も速く回せる。 回避促進：回避の待ち時間 −48%。 緊急装甲：3.5秒、被ダメージ −60%。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "融合進化",
     "rank": "2枠 → 1枠 · 1段階",
     "description": "回避後の防御を2.5秒に延長。回避も速く回せる。"
    },
    {
     "owned": 1,
     "status": "融合強化",
     "rank": "1 → 2段階",
     "description": "回避後の防御を3秒に延長。回避も速く回せる。"
    },
    {
     "owned": 2,
     "status": "融合強化",
     "rank": "2 → 3段階",
     "description": "回避後の防御を3.5秒に延長。回避も速く回せる。"
    }
   ]
  },
  {
   "id": "fusion-collector",
   "name": "ライフコレクター",
   "catalogDescription": "広い回収範囲と回復を継承し、回復の待ち時間も短縮。",
   "family": "generic",
   "familyLabel": "補強",
   "maxLevel": 3,
   "fusion": true,
   "materials": [
    "recovery-pack",
    "magnet"
   ],
   "unlockStage": null,
   "icon": {
    "kind": "image",
    "file": "fusion-collector.png"
   },
   "effectByLevel": [
    "広範囲の経験値回収で体力4回復。2.5秒に1回。 回収治癒：回収時4HP回復（2.5秒に1回）。 磁力回収：経験値の回収半径 17m。",
    "広範囲の経験値回収で体力5回復。2秒に1回。 回収治癒：回収時5HP回復（2秒に1回）。 磁力回収：経験値の回収半径 20m。",
    "広範囲の経験値回収で体力6回復。1.5秒に1回。 回収治癒：回収時6HP回復（1.5秒に1回）。 磁力回収：経験値の回収半径 23m。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "融合進化",
     "rank": "2枠 → 1枠 · 1段階",
     "description": "広範囲の経験値回収で体力4回復。2.5秒に1回。"
    },
    {
     "owned": 1,
     "status": "融合強化",
     "rank": "1 → 2段階",
     "description": "広範囲の経験値回収で体力5回復。2秒に1回。"
    },
    {
     "owned": 2,
     "status": "融合強化",
     "rank": "2 → 3段階",
     "description": "広範囲の経験値回収で体力6回復。1.5秒に1回。"
    }
   ]
  },
  {
   "id": "fusion-reactor",
   "name": "ヒートリアクター",
   "catalogDescription": "爆発強化と連続命中を継承。2回命中の爆発に中心への追加ダメージ。",
   "family": "explosion",
   "familyLabel": "爆発",
   "maxLevel": 3,
   "fusion": true,
   "materials": [
    "burst-cell",
    "compressed-charge"
   ],
   "unlockStage": null,
   "icon": {
    "kind": "image",
    "file": "fusion-reactor.png"
   },
   "effectByLevel": [
    "2回命中で強化爆発。中心の敵へさらに20ダメージ。 爆圧増幅：爆発・地雷の威力 +32%。 圧縮炸薬：同じ敵に2回命中で爆発。威力 80。",
    "2回命中で強化爆発。中心の敵へさらに40ダメージ。 爆圧増幅：爆発・地雷の威力 +40%。 圧縮炸薬：同じ敵に2回命中で爆発。威力 92。",
    "2回命中で強化爆発。中心の敵へさらに60ダメージ。 爆圧増幅：爆発・地雷の威力 +48%。 圧縮炸薬：同じ敵に2回命中で爆発。威力 105。"
   ],
   "offerCopy": [
    {
     "owned": 0,
     "status": "融合進化",
     "rank": "2枠 → 1枠 · 1段階",
     "description": "2回命中で強化爆発。中心の敵へさらに20ダメージ。"
    },
    {
     "owned": 1,
     "status": "融合強化",
     "rank": "1 → 2段階",
     "description": "2回命中で強化爆発。中心の敵へさらに40ダメージ。"
    },
    {
     "owned": 2,
     "status": "融合強化",
     "rank": "2 → 3段階",
     "description": "2回命中で強化爆発。中心の敵へさらに60ダメージ。"
    }
   ]
  }
 ]
};
