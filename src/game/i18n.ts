export type Lang = "en" | "zh" | "zh-CN";

export type I18nKey =
  | "greet"
  | "gameTitle"
  | "slogan"
  | "blurb"
  | "playVsAi"
  | "playVsFriend"
  | "aiHow1"
  | "aiHow2"
  | "aiHow3"
  | "easy"
  | "hard"
  | "easyBlurb"
  | "hard1"
  | "hard2"
  | "hard3"
  | "hard4"
  | "back"
  | "unofficial"
  | "license"
  | "architecture"
  | "github"
  | "fanTribute"
  | "producedBy"
  | "bestLevel"
  | "topEasy"
  | "topEasyStar"
  | "topHard"
  | "topHardStar"
  | "createRoom"
  | "join"
  | "code"
  | "roomCode"
  | "vsFriendLead"
  | "vsRule1"
  | "vsRule2"
  | "vsRule3"
  | "vsRule4"
  | "waiting"
  | "joining"
  | "lobbyHost"
  | "lobbyGuest"
  | "copy"
  | "copied"
  | "showQr"
  | "hideQr"
  | "qrcode"
  | "qrHint"
  | "cancel"
  | "versus"
  | "pvpMode"
  | "malteseTeam"
  | "retrieverTeam"
  | "level"
  | "levelHard"
  | "pause"
  | "paused"
  | "resume"
  | "restart"
  | "title"
  | "mute"
  | "unmute"
  | "allyLabel"
  | "allyManual"
  | "allyDefend"
  | "allyAttack"
  | "rotate"
  | "hintAi"
  | "hintPvp"
  | "maltese"
  | "retriever"
  | "almost"
  | "stretching"
  | "packingAi"
  | "packingVs"
  | "loading"
  | "friendLeft"
  | "friendLeftBody"
  | "takeBots"
  | "wait"
  | "endGame"
  | "pausedUntil"
  | "victory"
  | "buried"
  | "winHost"
  | "winGuest"
  | "loseHost"
  | "loseGuest"
  | "loseSolo"
  | "winSolo"
  | "rematch"
  | "rematchAsk"
  | "rematchWait"
  | "decline"
  | "fightAgain"
  | "leaveRoom"
  | "godSpeed"
  | "vs"
  | "waitingDots";

type Dict = Record<I18nKey, string>;

const EN: Dict = {
  greet: "Season's Greetings",
  gameTitle: "Maltese Snow War",
  slogan: "Hold, Dodge, and Throw!",
  blurb:
    "Command three Maltese in a snowball brawl against the golden retrievers. Hold to move, release to throw — a tap drops nearby, a long hold flies across the field.",
  playVsAi: "Play vs AI",
  playVsFriend: "Play vs Friend",
  aiHow1: "1. Press and hold a white Maltese",
  aiHow2: "2. Drag to dodge and line up your lane",
  aiHow3: "3. Tap for a short toss, hold longer to throw farther",
  easy: "Easy",
  hard: "Hard",
  easyBlurb: "Easy is the original SnowCraft pace.",
  hard1: "Everyone moves 3× faster; snowballs fly 2× faster",
  hard2: "Retrievers mix targets and dodge well",
  hard3: "Forts take 10 hits",
  hard4: "A buried Maltese stays down next round",
  back: "Back",
  unofficial: "Unofficial tribute",
  license: "Open Source License",
  architecture: "Architecture",
  github: "GitHub",
  fanTribute:
    "Fan tribute (二次創作). Gameplay after SnowCraft by Nicholson NY (1998). Dogs inspired by 線條小狗, illustrated by moonlab. Fight feel also referenced snowcraftjs by jeffreywilbur.",
  producedBy: "Produced with ❤️",
  bestLevel: "Best level {n}",
  topEasy: "Stage Clear (Easy): {t}",
  topEasyStar: "Stage Clear (Easy, Star Mode): {t}",
  topHard: "Stage Clear (Hard): {t}",
  topHardStar: "Stage Clear (Hard, Star Mode): {t}",
  createRoom: "Create room",
  join: "Join",
  code: "CODE",
  roomCode: "Room code",
  vsFriendLead:
    "Create a room and share the 6-letter code, or join with theirs. You play the Maltese; they play the retrievers.",
  vsRule1: "Host plays Maltese (white) on the right side of the field.",
  vsRule2: "Guest is mirrored and plays the golden retrievers.",
  vsRule3: "Fixed throw range & speed; auto-aim nearest foe.",
  vsRule4: "Two hits bury a dog. Forts give cover.",
  waiting: "Waiting",
  joining: "Joining",
  lobbyHost: "Share the QR or the code. Your friend scans it (or types the letters) on this same game. You are the Maltese.",
  lobbyGuest: "Looking for the host in this game… both of you need the same page, not two different copies.",
  copy: "Copy",
  copied: "Copied",
  showQr: "Show QR — scan to join",
  hideQr: "Hide QR",
  qrcode: "QR code",
  qrHint: "Friend scans this to open the game and join.",
  cancel: "Cancel",
  versus: "Versus",
  pvpMode: "PVP mode",
  malteseTeam: "Maltese",
  retrieverTeam: "Retrievers",
  level: "Level {n}",
  levelHard: "Level {n} · Hard",
  pause: "Pause",
  paused: "Paused",
  resume: "Resume",
  restart: "Restart",
  title: "Title",
  mute: "Mute",
  unmute: "Unmute",
  allyLabel: "Unselected Maltese",
  allyManual: "Manual",
  allyDefend: "Defend",
  allyAttack: "Attack",
  rotate: "Rotate your phone · landscape feels better",
  hintAi: "Hold a {dog} · tap = short toss · hold = far throw · pack snow between throws",
  hintPvp: "Hold a {dog} · tap = short toss · hold = far throw",
  maltese: "Maltese",
  retriever: "retriever",
  almost: "Almost there",
  stretching: "Dogs stretching",
  packingAi: "Packing snowballs for the yard…",
  packingVs: "Waiting until both yards finish packing…",
  loading: "Loading",
  friendLeft: "Friend left",
  friendLeftBody:
    "Connection dropped or timed out. You can fill their team with bots, wait in case they come back, or end the match.",
  takeBots: "Take over with bots",
  wait: "Wait",
  endGame: "End game",
  pausedUntil: "Paused until your friend reconnects.",
  victory: "Victory",
  buried: "Buried",
  winHost: "You buried the retrievers. Stay in the room for a rematch — no new code needed.",
  winGuest: "The retrievers buried the Maltese. Stay in the room for a rematch — no new code needed.",
  loseHost: "The retrievers buried you. Ask your friend for a rematch — you both have to accept.",
  loseGuest: "The Maltese buried you. Ask your friend for a rematch — you both have to accept.",
  loseSolo: "The retrievers buried you at level {n}. Best {best}.",
  winSolo: "You cleared level {n}!",
  rematch: "Rematch",
  rematchAsk: "Your friend wants a rematch.",
  rematchWait: "Waiting for your friend to accept…",
  decline: "Decline",
  fightAgain: "Fight again",
  leaveRoom: "Leave room",
  godSpeed: "★ Star Mode activated",
  vs: "vs",
  waitingDots: "Waiting…",
};

const ZH: Dict = {
  greet: "季節的問候",
  gameTitle: "線條小狗 大雪戰",
  slogan: "拎起、閃開、掉出！",
  blurb:
    "指揮三隻馬爾濟斯同金毛獵犬打雪仗。按住移動，放開投擲——輕點近拋，長按遠拋。",
  playVsAi: "對戰電腦",
  playVsFriend: "對戰好友",
  aiHow1: "1. 按住白色馬爾濟斯",
  aiHow2: "2. 拖曳閃避並對準通道",
  aiHow3: "3. 輕點短拋，長按遠拋",
  easy: "簡易",
  hard: "困難",
  easyBlurb: "簡易模式是原版 SnowCraft 的節奏。",
  hard1: "所有角色移動 3 倍速；雪球飛行 2 倍速",
  hard2: "金毛會混合目標並善於閃避",
  hard3: "堡壘需 10 下才能摧毀",
  hard4: "被埋的馬爾濟斯下一回合繼續倒下",
  back: "返回",
  unofficial: "非官方致敬",
  license: "開源授權",
  architecture: "架構說明",
  github: "GitHub",
  fanTribute:
    "二次創作致敬。玩法取自 Nicholson NY 的 SnowCraft（1998）。小狗靈感來自線條小狗，插畫 by moonlab。戰鬥手感亦參考 jeffreywilbur 的 snowcraftjs。",
  producedBy: "用心製作",
  bestLevel: "最高關卡 {n}",
  topEasy: "通關(簡易): {t}",
  topEasyStar: "通關(簡易,星星模式): {t}",
  topHard: "通關(困難): {t}",
  topHardStar: "通關(困難,星星模式): {t}",
  createRoom: "建立房間",
  join: "加入",
  code: "代碼",
  roomCode: "房間代碼",
  vsFriendLead: "建立房間並分享 6 位代碼，或輸入好友的代碼加入。你操控馬爾濟斯；對方操控金毛。",
  vsRule1: "房主操控右側白色馬爾濟斯。",
  vsRule2: "訪客畫面鏡像，操控金毛獵犬。",
  vsRule3: "固定投擲距離與速度；自動瞄準最近敵人。",
  vsRule4: "兩下埋住小狗。堡壘可作掩護。",
  waiting: "等待中",
  joining: "加入中",
  lobbyHost: "分享 QR 或代碼。好友掃描（或輸入字母）即可加入同一場。你是馬爾濟斯。",
  lobbyGuest: "正在尋找房主…雙方必須開啟同一頁面，而非兩個不同副本。",
  copy: "複製",
  copied: "已複製",
  showQr: "顯示 QR — 掃描加入",
  hideQr: "隱藏 QR",
  qrcode: "QR 碼",
  qrHint: "好友掃描即可開啟遊戲並加入。",
  cancel: "取消",
  versus: "對戰",
  pvpMode: "對戰模式",
  malteseTeam: "馬爾濟斯",
  retrieverTeam: "金毛",
  level: "第 {n} 關",
  levelHard: "第 {n} 關 · 困難",
  pause: "暫停",
  paused: "已暫停",
  resume: "繼續",
  restart: "重新開始",
  title: "回到主頁",
  mute: "靜音",
  unmute: "取消靜音",
  allyLabel: "未選中的馬爾濟斯",
  allyManual: "手動",
  allyDefend: "防守",
  allyAttack: "進攻",
  rotate: "請橫放手機 · 橫向遊玩更順手",
  hintAi: "按住{dog} · 輕點短拋 · 長按遠拋 · 投擲間需堆積雪球",
  hintPvp: "按住{dog} · 輕點短拋 · 長按遠拋",
  maltese: "馬爾濟斯",
  retriever: "金毛",
  almost: "即將開始",
  stretching: "小狗伸懶腰中",
  packingAi: "正在為院子堆積雪球…",
  packingVs: "等待雙方院子完成堆積…",
  loading: "載入中",
  friendLeft: "好友已離開",
  friendLeftBody: "連線中斷或逾時。可用機器人接手、等待對方回來，或結束對戰。",
  takeBots: "用機器人接手",
  wait: "等待",
  endGame: "結束遊戲",
  pausedUntil: "暫停中，等待好友重新連線。",
  victory: "勝利",
  buried: "被埋了…",
  winHost: "你埋了金毛。留在房間即可再戰——無需新代碼。",
  winGuest: "金毛埋了馬爾濟斯。留在房間即可再戰——無需新代碼。",
  loseHost: "金毛埋了你。請好友再戰——雙方都要接受。",
  loseGuest: "馬爾濟斯埋了你。請好友再戰——雙方都要接受。",
  loseSolo: "金毛在第 {n} 關埋了你。最高 {best}。",
  winSolo: "你通關了第 {n} 關！",
  rematch: "再戰",
  rematchAsk: "好友想再戰一場。",
  rematchWait: "等待好友接受…",
  decline: "拒絕",
  fightAgain: "再打一次",
  leaveRoom: "離開房間",
  godSpeed: "★ 星星模式已啟動",
  vs: "對",
  waitingDots: "等待中…",
};

const ZH_CN: Dict = {
  greet: "季节的问候",
  gameTitle: "线条小狗 大雪战",
  slogan: "拎起、闪开、扔出！",
  blurb:
    "指挥三只马尔济斯同金毛猎犬打雪仗。按住移动，放开投掷——轻点近抛，长按远抛。",
  playVsAi: "对战电脑",
  playVsFriend: "对战好友",
  aiHow1: "1. 按住白色马尔济斯",
  aiHow2: "2. 拖曳闪避并对准通道",
  aiHow3: "3. 轻点短抛，长按远抛",
  easy: "简易",
  hard: "困难",
  easyBlurb: "简易模式是原版 SnowCraft 的节奏。",
  hard1: "所有角色移动 3 倍速；雪球飞行 2 倍速",
  hard2: "金毛会混合目标并善于闪避",
  hard3: "堡垒需 10 下才能摧毁",
  hard4: "被埋的马尔济斯下一回合继续倒下",
  back: "返回",
  unofficial: "非官方致敬",
  license: "开源授权",
  architecture: "架构说明",
  github: "GitHub",
  fanTribute:
    "二次创作致敬。玩法取自 Nicholson NY 的 SnowCraft（1998）。小狗灵感来自线条小狗，插画 by moonlab。战斗手感亦参考 jeffreywilbur 的 snowcraftjs。",
  producedBy: "用心制作",
  bestLevel: "最高关卡 {n}",
  topEasy: "通关(简易): {t}",
  topEasyStar: "通关(简易,星星模式): {t}",
  topHard: "通关(困难): {t}",
  topHardStar: "通关(困难,星星模式): {t}",
  createRoom: "建立房间",
  join: "加入",
  code: "代码",
  roomCode: "房间代码",
  vsFriendLead: "建立房间并分享 6 位代码，或输入好友的代码加入。你操控马尔济斯；对方操控金毛。",
  vsRule1: "房主操控右侧白色马尔济斯。",
  vsRule2: "访客画面镜像，操控金毛猎犬。",
  vsRule3: "固定投掷距离与速度；自动瞄准最近敌人。",
  vsRule4: "两下埋住小狗。堡垒可作掩护。",
  waiting: "等待中",
  joining: "加入中",
  lobbyHost: "分享 QR 或代码。好友扫描（或输入字母）即可加入同一场。你是马尔济斯。",
  lobbyGuest: "正在寻找房主…双方必须开启同一页面，而非两个不同副本。",
  copy: "复制",
  copied: "已复制",
  showQr: "显示 QR — 扫描加入",
  hideQr: "隐藏 QR",
  qrcode: "QR 码",
  qrHint: "好友扫描即可开启游戏并加入。",
  cancel: "取消",
  versus: "对战",
  pvpMode: "对战模式",
  malteseTeam: "马尔济斯",
  retrieverTeam: "金毛",
  level: "第 {n} 关",
  levelHard: "第 {n} 关 · 困难",
  pause: "暂停",
  paused: "已暂停",
  resume: "继续",
  restart: "重新开始",
  title: "回到主页",
  mute: "静音",
  unmute: "取消静音",
  allyLabel: "未选中的马尔济斯",
  allyManual: "手动",
  allyDefend: "防守",
  allyAttack: "进攻",
  rotate: "请横放手机 · 横向游玩更顺手",
  hintAi: "按住{dog} · 轻点短抛 · 长按远抛 · 投掷间需堆积雪球",
  hintPvp: "按住{dog} · 轻点短抛 · 长按远抛",
  maltese: "马尔济斯",
  retriever: "金毛",
  almost: "即将开始",
  stretching: "小狗伸懒腰中",
  packingAi: "正在为院子堆积雪球…",
  packingVs: "等待双方院子完成堆积…",
  loading: "加载中",
  friendLeft: "好友已离开",
  friendLeftBody: "连线中断或超时。可用机器人接手、等待对方回来，或结束对战。",
  takeBots: "用机器人接手",
  wait: "等待",
  endGame: "结束游戏",
  pausedUntil: "暂停中，等待好友重新连线。",
  victory: "胜利",
  buried: "被埋了…",
  winHost: "你埋了金毛。留在房间即可再战——无需新代码。",
  winGuest: "金毛埋了马尔济斯。留在房间即可再战——无需新代码。",
  loseHost: "金毛埋了你。请好友再战——双方都要接受。",
  loseGuest: "马尔济斯埋了你。请好友再战——双方都要接受。",
  loseSolo: "金毛在第 {n} 关埋了你。最高 {best}。",
  winSolo: "你通关了第 {n} 关！",
  rematch: "再战",
  rematchAsk: "好友想再战一场。",
  rematchWait: "等待好友接受…",
  decline: "拒绝",
  fightAgain: "再打一次",
  leaveRoom: "离开房间",
  godSpeed: "★ 星星模式已启动",
  vs: "对",
  waitingDots: "等待中…",
};

const TABLES: Record<Lang, Dict> = {
  en: EN,
  zh: ZH,
  "zh-CN": ZH_CN,
};

const ORDER: Lang[] = ["en", "zh", "zh-CN"];

export function nextLang(current: Lang): Lang {
  const i = ORDER.indexOf(current);
  return ORDER[(i + 1) % ORDER.length]!;
}

export function nextLangLabel(current: Lang): string {
  const n = nextLang(current);
  if (n === "en") return "EN";
  if (n === "zh") return "繁中";
  return "简体";
}

type Vars = Record<string, string | number>;

export type TFn = (key: I18nKey, vars?: Vars) => string;

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] != null ? String(vars[k]) : `{${k}}`,
  );
}

export function formatClearTime(ms: number, lang: Lang): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (lang === "en") {
    return m > 0 ? `${m}m${s.toString().padStart(2, "0")}s` : `${s}s`;
  }
  // both zh / zh-CN
  if (m > 0) return `${m}分${s.toString().padStart(2, "0")}秒`;
  return `${s}秒`;
}

const STORAGE_KEY = "msw-lang";

function readStored(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "en" || v === "zh" || v === "zh-CN") return v;
  } catch {
    /* ignore */
  }
  return "en";
}

import { useCallback, useState } from "react";

export function useLang() {
  const [lang, setLang] = useState<Lang>(() =>
    typeof window === "undefined" ? "en" : readStored(),
  );

  const t: TFn = useCallback(
    (key, vars) => {
      const table = TABLES[lang] ?? EN;
      const raw = table[key] ?? EN[key] ?? key;
      return interpolate(raw, vars);
    },
    [lang],
  );

  const toggle = useCallback(() => {
    setLang((prev) => {
      const next = nextLang(prev);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const nextLabel = nextLangLabel(lang);

  return { lang, t, toggle, nextLabel };
}
