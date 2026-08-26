import { useCallback, useEffect, useState } from "react";

export type Lang = "en" | "zh" | "zh-CN";

const KEY = "snowcraft-lang";
const ORDER: Lang[] = ["en", "zh", "zh-CN"];

export function readLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "zh" || v === "en" || v === "zh-CN") return v;
  } catch {
    /* ignore */
  }
  return "en";
}

export function writeLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang =
      lang === "zh" ? "zh-Hant" : lang === "zh-CN" ? "zh-Hans" : "en";
  }
}

function nextLang(cur: Lang): Lang {
  const i = ORDER.indexOf(cur);
  return ORDER[(i + 1) % ORDER.length]!;
}

/** Label shown on the toggle = the language you switch *to*. */
export function nextLangLabel(cur: Lang): string {
  const n = nextLang(cur);
  if (n === "en") return "EN";
  if (n === "zh") return "繁中";
  return "简体";
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
  slogan: "拎起、闪开、扔出！",
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
  pause: "暂停",
  allyManual: "手动",
  allyDefend: "防守",
  allyAttack: "进攻",
  allyLabel: "未选中的小白",
  langSwitch: "EN",
  langSwitchToEn: "繁中",
  winSolo: "你过了 {n} 关。小金毛都被埋了 — 拎起、闪开、扔出！",
  winGuest: "小金毛埋掉了小白。留在房间再来一局，不用重新输入代码。",
  winHost: "你埋掉了小金毛。留在房间再来一局，不用重新输入代码。",
  loseGuest: "小白把你埋了。请朋友再来一局——双方都要同意。",
  loseHost: "小金毛把你埋了。请朋友再来一局——双方都要同意。",
  loseSolo: "小金毛在第 {n} 关把你埋了。最高 {best}。",
};

export type I18nKey = keyof typeof EN;

function table(lang: Lang): Record<I18nKey, string> {
  if (lang === "zh") return ZH;
  if (lang === "zh-CN") return ZH_CN;
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
  return lang === "en" ? `${m}m${r}s` : `${m}分${r}秒`;
}

export function useLang() {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const v = readLang();
    setLang(v);
    writeLang(v);
  }, []);
  const toggle = useCallback(() => {
    setLang((cur) => {
      const next = nextLang(cur);
      writeLang(next);
      return next;
    });
  }, []);
  const t = useCallback((key: I18nKey, vars?: Record<string, string | number>) => tr(lang, key, vars), [lang]);
  return { lang, t, toggle, nextLabel: nextLangLabel(lang) };
}
