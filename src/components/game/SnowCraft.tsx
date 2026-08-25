import {
  Copy,
  Home,
  Pause,
  Play,
  QrCode,
  RotateCcw,
  Shield,
  Smartphone,
  Swords,
  User,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SnowCraftGame } from "@/game/game";
import { normalizeCode } from "@/game/net";
import type { AllyMode, UiSnapshot } from "@/game/types";
import { cn } from "@/lib/utils";

const INITIAL: UiSnapshot = {
  screen: "title",
  level: 1,
  best: 0,
  redAlive: 3,
  greenAlive: 3,
  greenTotal: 3,
  muted: false,
  ready: true,
  loadDone: 0,
  loadTotal: 1,
  allyMode: "off",
  difficulty: "easy",
  net: {
    role: "solo",
    status: "off",
    code: null,
    team: "red",
    error: null,
    rematchMine: false,
    rematchTheirs: false,
    result: null,
    rttMs: null,
    link: "relay",
  },
  fps: 0,
};

export function SnowCraft() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<SnowCraftGame | null>(null);
  const [ui, setUi] = useState<UiSnapshot>(INITIAL);
  const [portraitPhone, setPortraitPhone] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [vsGate, setVsGate] = useState(false);
  const [aiGate, setAiGate] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new SnowCraftGame(canvas, setUi);
    gameRef.current = game;
    void game.start();
    const params = new URLSearchParams(window.location.search);
    const vs = params.get("vs");
    if (vs && normalizeCode(vs).length === 6) {
      window.setTimeout(() => game.joinVersus(vs), 400);
    }
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const sync = () => {
      const touch =
        window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
      setPortraitPhone(touch && window.innerHeight > window.innerWidth * 1.08);
    };
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  const prevScreen = useRef(ui.screen);
  useEffect(() => {
    if (ui.screen === "title" && prevScreen.current !== "title") {
      setAiGate(false);
      setVsGate(false);
    }
    prevScreen.current = ui.screen;
  }, [ui.screen]);

  useEffect(() => {
    if (aiGate) gameRef.current?.preparePlay();
  }, [aiGate]);

  const g = gameRef.current;
  const playing = ui.screen === "playing";
  const versus = ui.net.role !== "solo" || ui.net.status !== "off";
  const myTeam = ui.net.team;
  const rematchOpen = ui.net.status === "rematch" || ui.net.rematchTheirs || ui.net.rematchMine;

  const copyCode = async () => {
    if (!ui.net.code) return;
    const url = joinUrl(ui.net.code);
    try {
      await navigator.clipboard.writeText(`${ui.net.code} · ${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (ui.screen !== "lobby" || !ui.net.code) {
      setQrData(null);
      setQrOpen(false);
      return;
    }
    const url = joinUrl(ui.net.code);
    let cancelled = false;
    void import("qrcode").then((QRCode) =>
      QRCode.toDataURL(url, {
        width: 280,
        margin: 1,
        color: { dark: "#15202b", light: "#f4f7fa" },
        errorCorrectionLevel: "M",
      }),
    ).then((data) => {
      if (!cancelled) setQrData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [ui.screen, ui.net.code]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-ink text-surface">
      <canvas
        ref={canvasRef}
        className={cn(
          "absolute inset-0 z-0 size-full touch-none",
          playing || ui.screen === "paused" ? "" : "pointer-events-none",
        )}
        style={{ touchAction: "none" }}
      />

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        {playing && (
          <header className="pointer-events-none flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-4">
            <div className="rounded-xl bg-ink/70 px-3 py-2 backdrop-blur-sm">
              <p className="font-display text-lg font-semibold leading-tight tracking-tight">
                {ui.net.status !== "off" && ui.net.code
                  ? `VS ${ui.net.code}`
                  : ui.net.role !== "solo"
                    ? "PVP mode"
                    : `Level ${ui.level}${ui.difficulty === "hard" ? " · Hard" : ""}`}
              </p>
              <p className="text-xs text-ice">
                {ui.net.team === "green" ? "Retrievers" : ui.net.status !== "off" ? "Maltese" : `Best ${ui.best}`}
                {ui.net.status !== "off" && ui.net.code
                  ? ui.net.link === "direct"
                    ? ui.net.rttMs != null
                      ? ` · ${ui.net.rttMs}ms`
                      : " · direct"
                    : " · relay"
                  : ""}
                {playing ? ` · ${ui.fps || "–"}fps` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-ink/70 px-3 py-2 text-sm tabular-nums backdrop-blur-sm">
              <span className="font-medium text-primary">{ui.redAlive}</span>
              <span className="text-ice">vs</span>
              <span className="font-medium text-tan">{ui.greenAlive}</span>
            </div>
            <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
              <AllyToggle mode={ui.allyMode} onChange={(m) => g?.setAllyMode(m)} />
              <Button
                variant="ghost"
                size="icon"
                className="bg-ink/70 backdrop-blur-sm"
                aria-label={ui.muted ? "Unmute" : "Mute"}
                onClick={() => g?.toggleMute()}
              >
                {ui.muted ? <VolumeX /> : <Volume2 />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="bg-ink/70 backdrop-blur-sm"
                aria-label="Pause"
                onClick={() => g?.pause()}
              >
                <Pause />
              </Button>
            </div>
          </header>
        )}

        {playing && portraitPhone && (
          <div className="mt-auto flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <p className="flex items-center gap-2 rounded-full bg-ink/75 px-3.5 py-2 text-xs text-surface shadow-md backdrop-blur-sm sm:text-sm">
              <Smartphone className="size-4 rotate-90" aria-hidden />
              Rotate your phone · 橫向遊玩更順手
            </p>
          </div>
        )}

        {playing && !portraitPhone && (
          <p className="mt-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-ink/70 sm:text-sm">
            Hold a {myTeam === "green" ? "retriever" : "Maltese"} · tap = short toss · hold = far throw
            {versus ? "" : " · pack snow between throws"}
          </p>
        )}
      </div>

      {ui.screen === "title" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink bg-cover bg-center p-3 sm:p-4"
          style={{ backgroundImage: "url(/images/title-bg.jpg?v=3)" }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="pointer-events-none absolute inset-0 bg-ink/45" />
          <div className="relative z-10 my-auto flex w-full max-w-lg max-h-[min(92dvh,680px)] flex-col overflow-hidden rounded-xl border border-surface/15 bg-ink/80 shadow-xl landscape:max-md:max-w-3xl landscape:max-md:flex-row">
            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8 landscape:max-md:w-[55%] landscape:max-md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-ice sm:text-xs">
                    Season's Greetings
                  </p>
                  <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-surface sm:text-5xl">
                    Maltese Snow War
                  </h1>
                </div>
                <div className="flex shrink-0 -space-x-2 pt-1" aria-hidden>
                  <DogHead src="/sprites/red/idle-1.png" alt="" kind="maltese" className="z-10" />
                  <DogHead src="/sprites/green/idle-1.png" alt="" kind="retriever" />
                </div>
              </div>
              {!vsGate && !aiGate && (
                <>
                  <p className="mt-3 text-sm leading-relaxed text-surface/80 landscape:max-md:mt-2 landscape:max-md:text-xs">
                    Command three Maltese in a snowball brawl against the golden retrievers. Hold
                    to move, release to throw — a tap drops nearby, a long hold flies across the
                    field.
                  </p>
                  <ol className="mt-3 space-y-1 text-sm text-surface/75 landscape:max-md:mt-2 landscape:max-md:text-xs">
                    <li>1. Press and hold a white Maltese</li>
                    <li>2. Drag to dodge and line up your lane</li>
                    <li>3. Tap for a short toss, hold longer to throw farther</li>
                  </ol>
                  <p className="mt-4 text-[11px] leading-relaxed text-surface/50 landscape:max-md:mt-2 landscape:max-md:text-[10px]">
                    Fan tribute (二次創作). Gameplay after{" "}
                    <span className="text-surface/75">SnowCraft</span> by Nicholson NY (1998).
                    Dogs inspired by 線條小狗, illustrated by moonlab. Fight feel also referenced{" "}
                    <a
                      href="https://github.com/jeffreywilbur/snowcraftjs"
                      target="_blank"
                      rel="noreferrer"
                      className="text-ice underline decoration-ice/40 underline-offset-2 hover:text-surface"
                    >
                      snowcraftjs
                    </a>{" "}
                    by jeffreywilbur.
                  </p>
                </>
              )}
              {aiGate && (
                <div className="mt-3 landscape:max-md:mt-2">
                  <h2 className="font-display text-2xl font-semibold text-surface sm:text-3xl">
                    Vs AI
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-surface/80 landscape:max-md:text-xs">
                    Easy is the classic fight. Hard: both sides move 3× faster, snowballs fly at
                    2×, retrievers mix targets and dodge well, forts take 10 hits, and a buried
                    Maltese stays down next round.
                  </p>
                </div>
              )}
              {vsGate && (
                <div className="mt-3 landscape:max-md:mt-2">
                  <h2 className="font-display text-2xl font-semibold text-surface sm:text-3xl">
                    Versus a friend
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-surface/80 landscape:max-md:text-xs">
                    Create a room and share the 6-letter code, or join with theirs. You play the
                    Maltese; they play the retrievers.
                  </p>
                </div>
              )}
            </div>
            <div className="relative z-10 shrink-0 border-t border-surface/10 p-4 sm:p-6 landscape:max-md:w-[45%] landscape:max-md:border-l landscape:max-md:border-t-0 landscape:max-md:p-4">
              {aiGate ? (
                <div className="flex flex-col gap-2.5 sm:gap-3">
                  <Button size="lg" className="w-full" type="button" onClick={() => gameRef.current?.play("easy")}>
                    <Play />
                    Easy
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="w-full"
                    type="button"
                    onClick={() => gameRef.current?.play("hard")}
                  >
                    Hard
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full text-surface"
                    onClick={() => setAiGate(false)}
                  >
                    Back
                  </Button>
                </div>
              ) : !vsGate ? (
                <div className="flex flex-col gap-2.5 sm:gap-3">
                  <Button
                    size="lg"
                    className="w-full"
                    type="button"
                    onClick={() => setAiGate(true)}
                  >
                    <Play />
                    Play vs AI
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="w-full"
                    type="button"
                    onClick={() => setVsGate(true)}
                  >
                    <Users />
                    vs Friend
                  </Button>
                  {ui.net.error && <p className="text-center text-xs text-primary">{ui.net.error}</p>}
                  <p className="text-center text-xs text-ice">
                    {ui.best > 0 ? `Best level ${ui.best}` : "Unofficial tribute"}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 sm:gap-3">
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() => g?.createVersus()}
                  >
                    <Users />
                    Create room
                  </Button>
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      g?.joinVersus(joinCode);
                    }}
                  >
                    <input
                      value={joinCode}
                      onChange={(e) => setJoinCode(normalizeCode(e.target.value))}
                      maxLength={6}
                      placeholder="CODE"
                      aria-label="Room code"
                      autoCapitalize="characters"
                      className="h-12 min-w-0 flex-1 rounded-xl border border-surface/20 bg-ink/60 px-3 font-mono text-lg tracking-[0.28em] text-surface placeholder:text-surface/35"
                    />
                    <Button type="submit" variant="secondary" disabled={joinCode.length !== 6}>
                      Join
                    </Button>
                  </form>
                  {ui.net.error && <p className="text-center text-xs text-primary">{ui.net.error}</p>}
                  <Button variant="ghost" className="w-full text-surface" onClick={() => setVsGate(false)}>
                    Back
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {ui.screen === "loading" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-surface/15 bg-ink/90 p-6 text-center shadow-xl">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-ice">Almost there</p>
            <h2 className="mt-1 font-display text-3xl font-semibold">Dogs stretching</h2>
            <p className="mt-2 text-sm text-muted">Packing snowballs for the yard…</p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-surface/15">
              <div
                className="h-full rounded-full bg-ice transition-[width] duration-200"
                style={{
                  width: `${Math.min(100, Math.round((ui.loadDone / Math.max(1, ui.loadTotal)) * 100))}%`,
                }}
              />
            </div>
            <p className="mt-2 font-mono text-sm text-ice">
              {Math.min(100, Math.round((ui.loadDone / Math.max(1, ui.loadTotal)) * 100))}%
            </p>
            <Button variant="secondary" className="mt-5 w-full" onClick={() => g?.toTitle()}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {ui.screen === "lobby" && (
        <Modal>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Versus</p>
          <h2 className="mt-1 font-display text-3xl font-semibold">
            {ui.net.role === "host" ? "Waiting" : "Joining"}
          </h2>
          {ui.net.code && (
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => void copyCode()}
                className="flex w-full items-center justify-between rounded-xl bg-ink px-4 py-3 text-left text-surface"
              >
                <span className="font-mono text-3xl tracking-[0.28em]">{ui.net.code}</span>
                <span className="flex items-center gap-1 text-xs text-ice">
                  <Copy className="size-4" />
                  {copied ? "Copied" : "Copy"}
                </span>
              </button>
              {ui.net.role === "host" && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => setQrOpen((v) => !v)}
                    disabled={!qrData}
                  >
                    <QrCode />
                    {qrOpen ? "Hide QR" : "Show QR — scan to join"}
                  </Button>
                  {qrOpen && qrData && (
                    <div className="flex flex-col items-center gap-2 rounded-xl bg-ink px-4 py-3">
                      <img
                        src={qrData}
                        alt={`QR code to join room ${ui.net.code}`}
                        className="size-44 rounded-lg bg-surface sm:size-52"
                      />
                      <p className="text-center text-xs text-ice">
                        Friend scans this to open the game and join.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {ui.net.role === "host"
              ? "Share the QR or the code. Your friend scans it (or types the letters) on this same game. You are the Maltese."
              : ui.net.error
                ? ui.net.error
                : "Looking for the host in this game… both of you need the same page, not two different copies."}
          </p>
          {ui.net.error && ui.net.role === "host" && (
            <p className="mt-2 text-sm text-primary">{ui.net.error}</p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <Button variant="secondary" onClick={() => g?.cancelLobby()}>
              Cancel
            </Button>
          </div>
        </Modal>
      )}

      {ui.net.status === "disconnect" && (
        <Modal>
          <h2 className="font-display text-3xl font-semibold">Friend left</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Connection dropped or timed out. You can fill their team with bots, wait in case they
            come back, or end the match.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button size="lg" onClick={() => g?.takeBot()}>
              Take over with bots
            </Button>
            <Button variant="secondary" onClick={() => g?.waitForFriend()}>
              Wait
            </Button>
            <Button variant="secondary" onClick={() => g?.leaveRoom()}>
              End game
            </Button>
          </div>
        </Modal>
      )}

      {ui.net.status === "connecting" && ui.screen === "playing" && (
        <Modal>
          <h2 className="font-display text-3xl font-semibold">Waiting…</h2>
          <p className="mt-2 text-sm text-muted">Paused until your friend reconnects.</p>
          <div className="mt-6 flex flex-col gap-2">
            <Button size="lg" onClick={() => g?.takeBot()}>
              Take over with bots
            </Button>
            <Button variant="secondary" onClick={() => g?.leaveRoom()}>
              End game
            </Button>
          </div>
        </Modal>
      )}

      {ui.screen === "paused" && (
        <Modal>
          <h2 className="font-display text-3xl font-semibold">Paused</h2>
          <p className="mt-2 text-sm text-muted">
            Level {ui.level}
            {ui.difficulty === "hard" ? " · Hard" : ""}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button size="lg" onClick={() => g?.resume()}>
              Resume
            </Button>
            <Button variant="secondary" onClick={() => g?.retry()}>
              <RotateCcw />
              Restart
            </Button>
            <Button variant="secondary" onClick={() => g?.toggleMute()}>
              {ui.muted ? <VolumeX /> : <Volume2 />}
              {ui.muted ? "Unmute" : "Mute"}
            </Button>
          </div>
        </Modal>
      )}

      {(ui.screen === "gameover" || ui.net.status === "rematch") && (
        <Modal>
          <h2 className="font-display text-3xl font-semibold">
            {ui.net.result === "win" ? "Victory" : "Buried"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {versusGameoverCopy(ui)}
          </p>
          {ui.net.rematchTheirs && !ui.net.rematchMine && (
            <p className="mt-3 rounded-lg bg-leaf/30 px-3 py-2 text-sm">
              Your friend wants a rematch.
            </p>
          )}
          {ui.net.rematchMine && !ui.net.rematchTheirs && (
            <p className="mt-3 text-sm text-muted">Waiting for your friend to accept…</p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <Button
              size="lg"
              onClick={() => (rematchOpen ? g?.voteRematch(true) : g?.retry())}
              disabled={ui.net.rematchMine}
            >
              <RotateCcw />
              {rematchOpen ? "Rematch" : "Fight again"}
            </Button>
            {rematchOpen && (
              <Button variant="secondary" onClick={() => g?.voteRematch(false)}>
                Decline
              </Button>
            )}
            {!rematchOpen && ui.net.status !== "off" && ui.net.code && (
              <Button variant="secondary" onClick={() => g?.leaveRoom()}>
                Leave room
              </Button>
            )}
            {ui.net.status === "off" && (
              <Button variant="secondary" onClick={() => g?.toTitle()}>
                <Home />
                Title
              </Button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function joinUrl(code: string) {
  if (typeof window === "undefined") return `?vs=${code}`;
  return `${window.location.origin}${window.location.pathname}?vs=${code}`;
}

function versusGameoverCopy(ui: UiSnapshot) {
  if (ui.net.result === "win") {
    return ui.net.team === "green"
      ? "The retrievers buried the Maltese. Stay in the room for a rematch — no new code needed."
      : "You buried the retrievers. Stay in the room for a rematch — no new code needed.";
  }
  if (ui.net.status === "rematch" || ui.net.role !== "solo") {
    return ui.net.team === "green"
      ? "The Maltese buried you. Ask your friend for a rematch — you both have to accept."
      : "The retrievers buried you. Ask your friend for a rematch — you both have to accept.";
  }
  return `The retrievers buried you at level ${ui.level}. Best ${ui.best}.`;
}

function DogHead({
  src,
  alt,
  kind,
  className,
}: {
  src: string;
  alt: string;
  kind: "maltese" | "retriever";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative size-12 overflow-hidden rounded-full border border-surface/25 bg-[#c5d6e2] sm:size-16",
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        className={cn(
          "pointer-events-none absolute left-1/2 max-w-none -translate-x-1/2 select-none object-cover",
          kind === "retriever"
            ? "top-[-4%] h-[155%] w-[155%] object-[50%_18%]"
            : "top-[-8%] h-[175%] w-[175%] object-[50%_10%]",
        )}
      />
    </span>
  );
}

function AllyToggle({ mode, onChange }: { mode: AllyMode; onChange: (m: AllyMode) => void }) {
  const opts: { id: AllyMode; label: string; icon: ReactNode }[] = [
    { id: "off", label: "Manual", icon: <User /> },
    { id: "defend", label: "Defend", icon: <Shield /> },
    { id: "attack", label: "Attack", icon: <Swords /> },
  ];
  return (
    <div
      className="flex rounded-xl bg-ink/70 p-1 backdrop-blur-sm"
      role="group"
      aria-label="Unselected Maltese"
    >
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium sm:px-2.5 sm:text-xs",
            mode === o.id ? "bg-surface text-ink shadow-sm" : "text-surface/80 hover:text-surface",
          )}
          aria-pressed={mode === o.id}
        >
          {o.icon}
          <span className="hidden sm:inline">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function Modal({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-ink/55 p-4 backdrop-blur-[2px]">
      <div
        className={cn(
          "w-full max-w-sm rounded-xl border border-surface/15 bg-surface p-6 text-ink shadow-xl sm:p-7",
        )}
      >
        {children}
      </div>
    </div>
  );
}
