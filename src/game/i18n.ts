import { useCallback, useEffect, useState } from "react";

export type Lang = "en" | "zh" | "zh-CN" | "ja" | "ko";

const KEY = "snowcraft-lang";

/** Native labels — always shown in their own script. */
export const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "zh", label: "繁體中文" },
  { id: "zh-CN", label: "简体中文" },
  { id: "ja", label: "日本語" },
  { id: "ko", label: "한국어" },
];

const VALID = new Set<Lang>(LANGS.map((l) => l.id));

export function readLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v && VALID.has(v as Lang)) return v as Lang;
  } catch {
    /* ignore */
  }
  return "en";
}

function htmlLang(lang: Lang): string {
  if (lang === "zh") return "zh-Hant";
  if (lang === "zh-CN") return "zh-Hans";
  if (lang === "ja") return "ja";
  if (lang === "ko") return "ko";
  return "en";
}

export function writeLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = htmlLang(lang);
  }
}

export function langLabel(id: Lang): string {
  return LANGS.find((l) => l.id === id)?.label ?? "English";
}

const EN = {
  greet: "Season's Greetings",
  slogan: "Hold, Dodge, and Throw!",
  gameTitle: "Maltese Snow War",
  blurb:
    "Command three Maltese in a snowball brawl against the golden retrievers. Hold a dog to move, release to throw. Pack snow between shots.",
  unofficial: "Unofficial tribute",
  playVsAi: "Play vs AI",
  playVsFriend: "Play vs Friend",
  bestLevel: "Best level {n}",
  topEasy: "Stage Clear (Easy): {t}",
  topEasyStar: "Stage Clear (Easy, Star Mode Activated): {t}",
  topHard: "Stage Clear (Hard): {t}",
  topHardStar: "Stage Clear (Hard, Star Mode Activated): {t}",
  license: "Open Source License",
  architecture: "Architecture",
  github: "GitHub",
  fanTribute:
    "Fan tribute (二次創作). Gameplay after SnowCraft by Nicholson NY (1998). Dogs inspired by 線條小狗, illustrated by moonlab. Fight feel also referenced snowcraftjs by jeffreywilbur.",
  producedBy: "Produced by Gary.TC",
  aiHow1: "1. Press and hold a white Maltese",
  aiHow2: "2. Drag to dodge and line up your lane",
  aiHow3: "3. Tap for a short toss, hold longer to throw farther",
  easyBlurb: "Easy is the original SnowCraft pace. Clear 5 heats to win.",
  hard: "Hard",
  hard1: "Everyone moves 3× faster; snowballs fly 2× faster",
  hard2: "Retrievers mix targets and dodge well",
  hard3: "Forts take 10 hits",
  hard4: "A buried Maltese stays down next round",
  easy: "Easy",
  back: "Back",
  vsFriendLead:
    "Create a room and share the 6-letter code, or join with theirs. You play the Maltese; they play the retrievers.",
  vsRule1: "Hold a dog to move; release to throw",
  vsRule2: "Throws auto-aim the nearest foe — same range and speed every time",
  vsRule3: "No charge: a tap and a long hold fly the same",
  vsRule4: "Pack snow (~1s) before the next shot",
  createRoom: "Create room",
  join: "Join",
  code: "CODE",
  roomCode: "Room code",
  loading: "Loading",
  almost: "Almost there",
  stretching: "Dogs stretching",
  packingVs: "Waiting until both yards finish packing…",
  packingAi: "Packing snowballs for the yard…",
  cancel: "Cancel",
  versus: "Versus",
  waiting: "Waiting",
  joining: "Joining",
  copied: "Copied",
  copy: "Copy",
  hideQr: "Hide QR",
  showQr: "Show QR — scan to join",
  qrHint: "Friend scans this to open the game and join.",
  lobbyHost:
    "Share the QR or the code. You are the Maltese. Throws auto-aim and always fly the same distance — pack snow between shots.",
  lobbyGuest:
    "Looking for the host… you play the retrievers. Same throw: auto-aim, fixed range, pack between shots.",
  friendLeft: "Friend left",
  friendLeftBody:
    "Connection dropped or timed out. You can fill their team with bots, wait in case they come back, or end the match.",
  takeBots: "Take over with bots",
  wait: "Wait",
  endGame: "End game",
  waitingDots: "Waiting…",
  pausedUntil: "Paused until your friend reconnects.",
  paused: "Paused",
  resume: "Resume",
  restart: "Restart",
  title: "Title",
  victory: "Victory",
  buried: "Buried",
  rematchAsk: "Your friend wants a rematch.",
  rematchWait: "Waiting for your friend to accept…",
  rematch: "Rematch",
  fightAgain: "Fight again",
  decline: "Decline",
  leaveRoom: "Leave room",
  rotate: "Rotate your phone · 橫向遊玩更順手",
  hintAi: "Hold a {dog} · tap = short toss · hold = far throw · pack snow between throws",
  hintPvp: "Hold a {dog} · tap to throw · auto-aims nearest · fixed range · pack between shots",
  maltese: "Maltese",
  retriever: "retriever",
  malteseTeam: "Maltese",
  retrieverTeam: "Retrievers",
  pvpMode: "PVP mode",
  level: "Level {n}",
  levelHard: "Level {n} · Hard",
  godSpeed: "Star mode",
  mute: "Mute",
  unmute: "Unmute",
  language: "Language",
  pause: "Pause",
  allyManual: "Manual",
  allyDefend: "Defend",
  allyAttack: "Attack",
  allyLabel: "Unselected Maltese",
  langSwitch: "繁中",
  langSwitchToEn: "EN",
  winSolo: "You cleared {n} heats. The retrievers are buried — Hold, Dodge, and Throw!",
  winGuest: "The retrievers buried the Maltese. Stay in the room for a rematch — no new code needed.",
  winHost: "You buried the retrievers. Stay in the room for a rematch — no new code needed.",
  loseGuest: "The Maltese buried you. Ask your friend for a rematch — you both have to accept.",
  loseHost: "The retrievers buried you. Ask your friend for a rematch — you both have to accept.",
  loseSolo: "The retrievers buried you at level {n}. Best {best}.",
} as const;

const ZH: Record<keyof typeof EN, string> = {
  greet: "季節的問候",
  slogan: "拎起、閃開、掉出！",
  gameTitle: "線條小狗 大雪戰",
  blurb: "率領三隻小白，跟小金毛打一場雪仗。按住狗狗移動，放手丟雪球。兩次出手之間要搓雪。",
  unofficial: "非官方致敬",
  playVsAi: "對戰電腦",
  playVsFriend: "對戰朋友",
  bestLevel: "最高關卡 {n}",
  topEasy: "通關(簡易) : {t}",
  topEasyStar: "通關(簡易,星星模式啟動) : {t}",
  topHard: "通關(困難) : {t}",
  topHardStar: "通關(困難,星星模式啟動) : {t}",
  license: "開源授權",
  architecture: "架構說明",
  github: "GitHub",
  fanTribute:
    "同人致敬（二次創作）。玩法源自 Nicholson NY 的 SnowCraft（1998）。狗狗造型靈感來自線條小狗，插畫 moonlab。對戰手感亦參考 jeffreywilbur 的 snowcraftjs。",
  producedBy: "製作：Gary.TC",
  aiHow1: "1. 按住一隻小白",
  aiHow2: "2. 拖動閃避、對準通道",
  aiHow3: "3. 輕點近丟，長按丟得更遠",
  easyBlurb: "簡單是原版 SnowCraft 節奏。過 5 關即勝利。",
  hard: "困難",
  hard1: "大家移動快 3 倍；雪球快 2 倍",
  hard2: "小金毛會換目標、更懂閃",
  hard3: "雪堆要打 10 下",
  hard4: "倒下的小白下一回合不會復活",
  easy: "簡單",
  back: "返回",
  vsFriendLead: "開房分享 6 位代碼，或輸入對方的碼。你操控小白；對方操控小金毛。",
  vsRule1: "按住狗狗移動；放手丟球",
  vsRule2: "自動瞄最近敵人——每次射程、球速相同",
  vsRule3: "沒有蓄力：輕點同長按一樣遠",
  vsRule4: "出手後搓雪約 1 秒才能再丟",
  createRoom: "建立房間",
  join: "加入",
  code: "代碼",
  roomCode: "房間代碼",
  loading: "載入中",
  almost: "就快好",
  stretching: "狗狗在伸懶腰",
  packingVs: "等兩邊都搓好雪球…",
  packingAi: "正在為雪場搓雪球…",
  cancel: "取消",
  versus: "對戰",
  waiting: "等候中",
  joining: "加入中",
  copied: "已複製",
  copy: "複製",
  hideQr: "收起 QR",
  showQr: "顯示 QR — 掃碼加入",
  qrHint: "朋友掃這個即可打開遊戲並加入。",
  lobbyHost: "分享 QR 或代碼。你是小白。丟球自動瞄準，每次距離相同——記得搓雪。",
  lobbyGuest: "正在找房主…你操控小金毛。同樣是自動瞄、固定射程、搓雪再丟。",
  friendLeft: "朋友離開了",
  friendLeftBody: "連線中斷或逾時。可以用電腦接手、繼續等候，或結束比賽。",
  takeBots: "用電腦接手",
  wait: "等候",
  endGame: "結束遊戲",
  waitingDots: "等候中…",
  pausedUntil: "暫停，等朋友重新連上。",
  paused: "暫停",
  resume: "繼續",
  restart: "重來",
  title: "回到主頁",
  victory: "勝利",
  buried: "被埋了…",
  rematchAsk: "朋友想再來一局。",
  rematchWait: "等朋友接受…",
  rematch: "再來一局",
  fightAgain: "再打一次",
  decline: "拒絕",
  leaveRoom: "離開房間",
  rotate: "請把手機轉橫 · landscape is better",
  hintAi: "按住{dog} · 輕點近丟 · 長按遠丟 · 出手後搓雪",
  hintPvp: "按住{dog} · 輕點丟出 · 自動瞄最近 · 固定射程 · 出手後搓雪",
  maltese: "小白",
  retriever: "小金毛",
  malteseTeam: "小白",
  retrieverTeam: "小金毛",
  pvpMode: "對戰模式",
  level: "第 {n} 關",
  levelHard: "第 {n} 關 · 困難",
  godSpeed: "星星模式",
  mute: "靜音",
  unmute: "開聲",
  language: "語言",
  pause: "暫停",
  allyManual: "手動",
  allyDefend: "防守",
  allyAttack: "進攻",
  allyLabel: "未選中的小白",
  langSwitch: "EN",
  langSwitchToEn: "繁中",
  winSolo: "你過了 {n} 關。小金毛都被埋了 — 拎起、閃開、掉出！",
  winGuest: "小金毛埋掉了小白。留在房間再來一局，不用重新輸入代碼。",
  winHost: "你埋掉了小金毛。留在房間再來一局，不用重新輸入代碼。",
  loseGuest: "小白把你埋了。請朋友再來一局——雙方都要同意。",
  loseHost: "小金毛把你埋了。請朋友再來一局——雙方都要同意。",
  loseSolo: "小金毛在第 {n} 關把你埋了。最高 {best}。",
};

/** Simplified Chinese — same meaning as 繁中, Mainland orthography. */
const ZH_CN: Record<keyof typeof EN, string> = {
  greet: "季节的问候",
  slogan: "拿起、躲开、扔出！",
  gameTitle: "线条小狗 大雪战",
  blurb: "率领三只小白，跟小金毛打一场雪仗。按住狗狗移动，放手扔雪球。两次出手之间要搓雪。",
  unofficial: "非官方致敬",
  playVsAi: "对战电脑",
  playVsFriend: "对战朋友",
  bestLevel: "最高关卡 {n}",
  topEasy: "通关(简易) : {t}",
  topEasyStar: "通关(简易,星星模式启动) : {t}",
  topHard: "通关(困难) : {t}",
  topHardStar: "通关(困难,星星模式启动) : {t}",
  license: "开源授权",
  architecture: "架构说明",
  github: "GitHub",
  fanTribute:
    "同人致敬（二次创作）。玩法源自 Nicholson NY 的 SnowCraft（1998）。狗狗造型灵感来自线条小狗，插画 moonlab。对战手感亦参考 jeffreywilbur 的 snowcraftjs。",
  producedBy: "制作：Gary.TC",
  aiHow1: "1. 按住一只小白",
  aiHow2: "2. 拖动闪避、对准通道",
  aiHow3: "3. 轻点近扔，长按扔得更远",
  easyBlurb: "简单是原版 SnowCraft 节奏。过 5 关即胜利。",
  hard: "困难",
  hard1: "大家移动快 3 倍；雪球快 2 倍",
  hard2: "小金毛会换目标、更懂闪",
  hard3: "雪堆要打 10 下",
  hard4: "倒下的小白下一回合不会复活",
  easy: "简单",
  back: "返回",
  vsFriendLead: "开房分享 6 位代码，或输入对方的码。你操控小白；对方操控小金毛。",
  vsRule1: "按住狗狗移动；放手扔球",
  vsRule2: "自动瞄最近敌人——每次射程、球速相同",
  vsRule3: "没有蓄力：轻点同长按一样远",
  vsRule4: "出手后搓雪约 1 秒才能再扔",
  createRoom: "建立房间",
  join: "加入",
  code: "代码",
  roomCode: "房间代码",
  loading: "载入中",
  almost: "就快好",
  stretching: "狗狗在伸懒腰",
  packingVs: "等两边都搓好雪球…",
  packingAi: "正在为雪场搓雪球…",
  cancel: "取消",
  versus: "对战",
  waiting: "等候中",
  joining: "加入中",
  copied: "已复制",
  copy: "复制",
  hideQr: "收起 QR",
  showQr: "显示 QR — 扫码加入",
  qrHint: "朋友扫这个即可打开游戏并加入。",
  lobbyHost: "分享 QR 或代码。你是小白。扔球自动瞄准，每次距离相同——记得搓雪。",
  lobbyGuest: "正在找房主…你操控小金毛。同样是自动瞄、固定射程、搓雪再扔。",
  friendLeft: "朋友离开了",
  friendLeftBody: "连线中断或超时。可以用电脑接手、继续等候，或结束比赛。",
  takeBots: "用电脑接手",
  wait: "等候",
  endGame: "结束游戏",
  waitingDots: "等候中…",
  pausedUntil: "暂停，等朋友重新连上。",
  paused: "暂停",
  resume: "继续",
  restart: "重来",
  title: "回到主页",
  victory: "胜利",
  buried: "被埋了…",
  rematchAsk: "朋友想再来一局。",
  rematchWait: "等朋友接受…",
  rematch: "再来一局",
  fightAgain: "再打一次",
  decline: "拒绝",
  leaveRoom: "离开房间",
  rotate: "请把手机转横 · landscape is better",
  hintAi: "按住{dog} · 轻点近扔 · 长按远扔 · 出手后搓雪",
  hintPvp: "按住{dog} · 轻点扔出 · 自动瞄最近 · 固定射程 · 出手后搓雪",
  maltese: "小白",
  retriever: "小金毛",
  malteseTeam: "小白",
  retrieverTeam: "小金毛",
  pvpMode: "对战模式",
  level: "第 {n} 关",
  levelHard: "第 {n} 关 · 困难",
  godSpeed: "星星模式",
  mute: "静音",
  unmute: "开声",
  language: "语言",
  pause: "暂停",
  allyManual: "手动",
  allyDefend: "防守",
  allyAttack: "进攻",
  allyLabel: "未选中的小白",
  langSwitch: "EN",
  langSwitchToEn: "繁中",
  winSolo: "你过了 {n} 关。小金毛都被埋了 — 拿起、躲开、扔出！",
  winGuest: "小金毛埋掉了小白。留在房间再来一局，不用重新输入代码。",
  winHost: "你埋掉了小金毛。留在房间再来一局，不用重新输入代码。",
  loseGuest: "小白把你埋了。请朋友再来一局——双方都要同意。",
  loseHost: "小金毛把你埋了。请朋友再来一局——双方都要同意。",
  loseSolo: "小金毛在第 {n} 关把你埋了。最高 {best}。",
};

const JA: Record<keyof typeof EN, string> = {
  greet: "季節のご挨拶",
  slogan: "つかんで、よけて、投げる！",
  gameTitle: "マルチーズ雪合戦",
  blurb:
    "3匹のマルチーズを率いて、ゴールデンレトリバーと雪合戦。犬を長押しして移動、離すと投げる。投げる前に雪を丸めよう。",
  unofficial: "非公式トリビュート",
  playVsAi: "AIと対戦",
  playVsFriend: "友だちと対戦",
  bestLevel: "最高レベル {n}",
  topEasy: "クリア（かんたん）: {t}",
  topEasyStar: "クリア（かんたん・スターモード）: {t}",
  topHard: "クリア（むずかしい）: {t}",
  topHardStar: "クリア（むずかしい・スターモード）: {t}",
  license: "オープンソースライセンス",
  architecture: "アーキテクチャ",
  github: "GitHub",
  fanTribute:
    "ファン作品（二次創作）。ゲームプレイは Nicholson NY の SnowCraft（1998）に基づく。犬のデザインは線条小狗／moonlab に着想。対戦の手触りは jeffreywilbur の snowcraftjs も参考。",
  producedBy: "制作：Gary.TC",
  aiHow1: "1. 白いマルチーズを長押し",
  aiHow2: "2. ドラッグして回避・レーン合わせ",
  aiHow3: "3. タップは近く、長押しは遠くまで",
  easyBlurb: "かんたんは本家 SnowCraft のペース。5ヒートで勝利。",
  hard: "むずかしい",
  hard1: "全員の移動3倍、雪玉は2倍速",
  hard2: "レトリバーは標的を変え、よくかわす",
  hard3: "砦は10発で壊れる",
  hard4: "埋まったマルチーズは次ラウンドも起きない",
  easy: "かんたん",
  back: "戻る",
  vsFriendLead:
    "部屋を作って6文字コードを共有するか、相手のコードで参加。あなたはマルチーズ、相手はレトリバー。",
  vsRule1: "犬を押さえて移動、離すと投げる",
  vsRule2: "投げるときは一番近い敵に自動照準——飛距離と速度は毎回同じ",
  vsRule3: "チャージなし：タップも長押しも同じ飛距離",
  vsRule4: "次の投球の前に雪を丸める（約1秒）",
  createRoom: "部屋を作る",
  join: "参加",
  code: "コード",
  roomCode: "ルームコード",
  loading: "読み込み中",
  almost: "もう少し",
  stretching: "ワンちゃん準備中",
  packingVs: "両方の庭が雪を丸め終わるまで待っています…",
  packingAi: "庭の雪玉を丸めています…",
  cancel: "キャンセル",
  versus: "対戦",
  waiting: "待機中",
  joining: "参加中",
  copied: "コピーした",
  copy: "コピー",
  hideQr: "QRを隠す",
  showQr: "QRを表示 — スキャンして参加",
  qrHint: "友だちがこれをスキャンするとゲームを開いて参加できます。",
  lobbyHost:
    "QRかコードを共有。あなたはマルチーズ。投げは自動照準で毎回同じ距離——投げる前に雪を丸めて。",
  lobbyGuest:
    "ホストを探しています…あなたはレトリバー。同じ投げ：自動照準、固定飛距離、丸めてから投げる。",
  friendLeft: "友だちが離れました",
  friendLeftBody:
    "切断またはタイムアウト。ボットで埋める、戻るのを待つ、試合を終える、が選べます。",
  takeBots: "ボットで引き継ぐ",
  wait: "待つ",
  endGame: "試合終了",
  waitingDots: "待機中…",
  pausedUntil: "友だちが再接続するまで一時停止。",
  paused: "一時停止",
  resume: "再開",
  restart: "やり直す",
  title: "タイトルへ",
  victory: "勝利",
  buried: "埋まっちゃった…",
  rematchAsk: "友だちが再戦を希望しています。",
  rematchWait: "友だちの承諾待ち…",
  rematch: "再戦",
  fightAgain: "もう一度",
  decline: "断る",
  leaveRoom: "部屋を出る",
  rotate: "スマホを横にしてね · landscape is better",
  hintAi: "{dog}を長押し · タップは近く · 長押しは遠く · 投げる前に丸める",
  hintPvp: "{dog}を長押し · タップで投げる · 一番近くに照準 · 固定飛距離 · 丸めてから投げる",
  maltese: "マルチーズ",
  retriever: "レトリバー",
  malteseTeam: "マルチーズ",
  retrieverTeam: "レトリバー",
  pvpMode: "PvPモード",
  level: "レベル {n}",
  levelHard: "レベル {n} · むずかしい",
  godSpeed: "スターモード",
  mute: "ミュート",
  unmute: "ミュート解除",
  language: "言語",
  pause: "一時停止",
  allyManual: "手動",
  allyDefend: "守る",
  allyAttack: "攻める",
  allyLabel: "未選択のマルチーズ",
  langSwitch: "EN",
  langSwitchToEn: "日本語",
  winSolo: "{n}ヒートをクリア。レトリバーは埋まった — つかんで、よけて、投げる！",
  winGuest: "レトリバーがマルチーズを埋めた。同じ部屋で再戦できます。新しいコードは不要。",
  winHost: "レトリバーを埋めた。同じ部屋で再戦できます。新しいコードは不要。",
  loseGuest: "マルチーズに埋められた。再戦は双方の承諾が必要。",
  loseHost: "レトリバーに埋められた。再戦は双方の承諾が必要。",
  loseSolo: "レベル {n} で埋められた。最高 {best}。",
};

const KO: Record<keyof typeof EN, string> = {
  greet: "계절의 인사",
  slogan: "잡고, 피하고, 던져라!",
  gameTitle: "말티즈 눈싸움",
  blurb:
    "말티즈 세 마리를 이끌고 골든 리트리버와 눈싸움. 강아지를 길게 눌러 이동하고, 손을 떼면 던집니다. 던지기 전에 눈을 뭉치세요.",
  unofficial: "비공식 헌정",
  playVsAi: "AI와 대결",
  playVsFriend: "친구와 대결",
  bestLevel: "최고 레벨 {n}",
  topEasy: "클리어 (쉬움): {t}",
  topEasyStar: "클리어 (쉬움, 스타 모드): {t}",
  topHard: "클리어 (어려움): {t}",
  topHardStar: "클리어 (어려움, 스타 모드): {t}",
  license: "오픈소스 라이선스",
  architecture: "아키텍처",
  github: "GitHub",
  fanTribute:
    "팬 헌정(이차 창작). 플레이는 Nicholson NY의 SnowCraft(1998)를 따릅니다. 강아지 디자인은 선조강아지 / moonlab에서 영감. 대결 손맛은 jeffreywilbur의 snowcraftjs도 참고.",
  producedBy: "제작: Gary.TC",
  aiHow1: "1. 하얀 말티즈를 길게 누르기",
  aiHow2: "2. 드래그해서 피하고 줄을 맞추기",
  aiHow3: "3. 탭은 가깝게, 길게 누르면 멀리",
  easyBlurb: "쉬움은 원작 SnowCraft 페이스. 5라운드를 클리어하면 승리.",
  hard: "어려움",
  hard1: "모두 이동 3배, 눈덩이는 2배 속도",
  hard2: "리트리버는 목표를 바꾸고 잘 피합니다",
  hard3: "요새는 10대를 맞아야 합니다",
  hard4: "묻힌 말티즈는 다음 라운드에도 일어나지 않습니다",
  easy: "쉬움",
  back: "뒤로",
  vsFriendLead:
    "방을 만들고 6글자 코드를 공유하거나, 상대 코드로 입장. 당신은 말티즈, 상대는 리트리버.",
  vsRule1: "강아지를 잡아 이동, 손을 떼면 던지기",
  vsRule2: "가장 가까운 적에게 자동 조준 — 사거리와 속도는 매번 같음",
  vsRule3: "차징 없음: 탭과 길게 누르기 모두 같은 거리",
  vsRule4: "다음 투구 전에 눈을 뭉침 (약 1초)",
  createRoom: "방 만들기",
  join: "참가",
  code: "코드",
  roomCode: "방 코드",
  loading: "불러오는 중",
  almost: "거의 다 됐어요",
  stretching: "강아지 준비 중",
  packingVs: "양쪽 마당이 눈을 다 뭉칠 때까지 기다리는 중…",
  packingAi: "마당에 눈덩이를 뭉치는 중…",
  cancel: "취소",
  versus: "대전",
  waiting: "대기 중",
  joining: "참가 중",
  copied: "복사됨",
  copy: "복사",
  hideQr: "QR 숨기기",
  showQr: "QR 보기 — 스캔해서 참가",
  qrHint: "친구가 이것을 스캔하면 게임을 열고 참가합니다.",
  lobbyHost:
    "QR 또는 코드를 공유하세요. 당신은 말티즈. 던지기는 자동 조준이고 매번 같은 거리 — 던지기 전에 눈을 뭉치세요.",
  lobbyGuest:
    "호스트를 찾는 중… 당신은 리트리버. 같은 던지기: 자동 조준, 고정 사거리, 뭉친 뒤 던지기.",
  friendLeft: "친구가 나갔습니다",
  friendLeftBody:
    "연결이 끊겼거나 시간 초과. 봇으로 채우거나, 기다리거나, 경기를 끝낼 수 있습니다.",
  takeBots: "봇으로 이어하기",
  wait: "기다리기",
  endGame: "경기 종료",
  waitingDots: "대기 중…",
  pausedUntil: "친구가 다시 연결될 때까지 일시정지.",
  paused: "일시정지",
  resume: "계속",
  restart: "다시 시작",
  title: "타이틀로",
  victory: "승리",
  buried: "묻혔어요…",
  rematchAsk: "친구가 재경기를 원합니다.",
  rematchWait: "친구의 수락을 기다리는 중…",
  rematch: "재경기",
  fightAgain: "다시 싸우기",
  decline: "거절",
  leaveRoom: "방 나가기",
  rotate: "휴대폰을 가로로 · landscape is better",
  hintAi: "{dog}를 길게 · 탭은 가깝게 · 길게는 멀리 · 던지기 전 뭉치기",
  hintPvp: "{dog}를 길게 · 탭으로 던지기 · 가장 가까운 조준 · 고정 사거리 · 뭉친 뒤 던지기",
  maltese: "말티즈",
  retriever: "리트리버",
  malteseTeam: "말티즈",
  retrieverTeam: "리트리버",
  pvpMode: "PvP 모드",
  level: "레벨 {n}",
  levelHard: "레벨 {n} · 어려움",
  godSpeed: "스타 모드",
  mute: "음소거",
  unmute: "음소거 해제",
  language: "언어",
  pause: "일시정지",
  allyManual: "수동",
  allyDefend: "수비",
  allyAttack: "공격",
  allyLabel: "선택되지 않은 말티즈",
  langSwitch: "EN",
  langSwitchToEn: "한국어",
  winSolo: "{n}라운드를 클리어. 리트리버가 묻혔습니다 — 잡고, 피하고, 던져라!",
  winGuest: "리트리버가 말티즈를 묻었습니다. 같은 방에서 재경기할 수 있습니다. 새 코드는 필요 없습니다.",
  winHost: "리트리버를 묻었습니다. 같은 방에서 재경기할 수 있습니다. 새 코드는 필요 없습니다.",
  loseGuest: "말티즈에게 묻혔습니다. 재경기는 양쪽이 모두 동의해야 합니다.",
  loseHost: "리트리버에게 묻혔습니다. 재경기는 양쪽이 모두 동의해야 합니다.",
  loseSolo: "레벨 {n}에서 묻혔습니다. 최고 {best}.",
};

export type I18nKey = keyof typeof EN;

function table(lang: Lang): Record<I18nKey, string> {
  if (lang === "zh") return ZH;
  if (lang === "zh-CN") return ZH_CN;
  if (lang === "ja") return JA;
  if (lang === "ko") return KO;
  return EN as unknown as Record<I18nKey, string>;
}

export function tr(lang: Lang, key: I18nKey, vars?: Record<string, string | number>) {
  let s: string = table(lang)[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

export function formatClock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function formatClearTime(ms: number, lang: Lang) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (lang === "en") return `${m}m${r}s`;
  if (lang === "ko") return `${m}분 ${r}초`;
  return `${m}分${r}秒`;
}

export function useLang() {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const v = readLang();
    setLangState(v);
    writeLang(v);
  }, []);
  const setLang = useCallback((next: Lang) => {
    writeLang(next);
    setLangState(next);
  }, []);
  const t = useCallback((key: I18nKey, vars?: Record<string, string | number>) => tr(lang, key, vars), [lang]);
  return { lang, t, setLang };
}
