import {
  Copy,
  Pause,
  Play,
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
  ready: false,
  allyMode: "off",
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
};

export function SnowCraft() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<SnowCraftGame | null>(null);
  const [ui, setUi] = useState<UiSnapshot>(INITIAL);
  const [portraitPhone, setPortraitPhone] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);

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

  const g = gameRef.current;
  const playing = ui.screen === "playing";
  const versus = ui.net.role !== "solo" || ui.net.status !== "off";
  const myTeam = ui.net.team;

  const copyCode = async () => {
    if (!ui.net.code) return;
    const url = `${window.location.origin}${window.location.pathname}?vs=${ui.net.code}`;
    try {
      await navigator.clipboard.writeText(`${ui.net.code} · ${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-ink text-surface">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full touch-none"
        style={{ touchAction: "none" }}
      />

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        {playing && (
          <header className="pointer-events-none flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-4">
            <div className="rounded-xl bg-ink/70 px-3 py-2 backdrop-blur-sm">
              <p className="font-display text-lg font-semibold leading-tight tracking-tight">
                {ui.net.status !== "off" && ui.net.code ? `VS ${ui.net.code}` : `Level ${ui.level}`}
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
          className="absolute inset-0 flex items-center justify-center bg-ink bg-cover bg-center p-4"
          style={{ backgroundImage: "url(/images/title-bg.jpg?v=2)" }}
        >
          <div className="absolute inset-0 bg-ink/45" />
          <div className="relative w-full max-w-md rounded-xl border border-surface/15 bg-ink/80 p-6 shadow-xl backdrop-blur-md sm:p-8">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-ice">
              Season's Greetings
            </p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-surface sm:text-5xl">
              SnowCraft
            </h1>
            <p className="mt-1 font-display text-xl text-ice">打雪仗</p>
            <p className="mt-4 text-sm leading-relaxed text-surface/80">
              Command three 線條小狗 Maltese in a snowball brawl against the golden
              retrievers. Hold to move, release to throw — a tap drops nearby, a long
              hold flies across the field. Hide behind snow forts. Two hits and
              you're buried.
            </p>
            <ol className="mt-4 space-y-1.5 text-sm text-surface/75">
              <li>1. Press and hold a white Maltese</li>
              <li>2. Drag to dodge and line up your lane</li>
              <li>3. Tap for a short toss, hold longer to throw farther</li>
              <li>4. After a throw, pack snow before the next one</li>
              <li>5. Duck behind forts — snowballs splat on the mound</li>
            </ol>
            <div className="mt-6 flex flex-col gap-3">
              <Button
                size="lg"
                className="w-full"
                disabled={!ui.ready}
                onClick={() => g?.play()}
              >
                <Play />
                {ui.ready ? "Play vs AI" : "Loading…"}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="w-full"
                disabled={!ui.ready}
                onClick={() => g?.createVersus()}
              >
                <Users />
                Versus — create room
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
                <Button type="submit" variant="secondary" disabled={!ui.ready || joinCode.length !== 6}>
                  Join
                </Button>
              </form>
              {ui.net.error && <p className="text-center text-xs text-primary">{ui.net.error}</p>}
              <p className="text-center text-xs text-ice">
                {ui.best > 0 ? `Best level ${ui.best}` : "A remake of the 1998 classic"}
              </p>
            </div>
          </div>
          {portraitPhone && (
            <p className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink/75 px-3.5 py-2 text-xs text-surface shadow-md backdrop-blur-sm">
              <Smartphone className="size-4 rotate-90" aria-hidden />
              Rotate your phone · 橫向遊玩更順手
            </p>
          )}
        </div>
      )}

      {ui.screen === "lobby" && (
        <Modal>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">Versus</p>
          <h2 className="mt-1 font-display text-3xl font-semibold">
            {ui.net.role === "host" ? "Waiting" : "Joining"}
          </h2>
          {ui.net.code && (
            <button
              type="button"
              onClick={() => void copyCode()}
              className="mt-4 flex w-full items-center justify-between rounded-xl bg-ink px-4 py-3 text-left text-surface"
            >
              <span className="font-mono text-3xl tracking-[0.28em]">{ui.net.code}</span>
              <span className="flex items-center gap-1 text-xs text-ice">
                <Copy className="size-4" />
                {copied ? "Copied" : "Copy"}
              </span>
            </button>
          )}
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {ui.net.role === "host"
              ? "Copy the code (or the link). Your friend must open this same game, tap Join, and type the letters. You are the Maltese."
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
          <p className="mt-2 text-sm text-muted">Level {ui.level}</p>
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

      {ui.screen === "gameover" && (
        <Modal>
          <h2 className="font-display text-3xl font-semibold">
            {ui.net.result === "win" ? "Victory" : "Buried"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {versusGameoverCopy(ui)}
          </p>
          {ui.net.status === "rematch" && ui.net.rematchTheirs && !ui.net.rematchMine && (
            <p className="mt-3 rounded-lg bg-leaf/30 px-3 py-2 text-sm">
              Your friend wants a rematch.
            </p>
          )}
          {ui.net.status === "rematch" && ui.net.rematchMine && !ui.net.rematchTheirs && (
            <p className="mt-3 text-sm text-muted">Waiting for your friend to accept…</p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <Button
              size="lg"
              onClick={() => (ui.net.status === "rematch" ? g?.voteRematch(true) : g?.retry())}
              disabled={ui.net.status === "rematch" && ui.net.rematchMine}
            >
              <RotateCcw />
              {ui.net.status === "rematch" ? "Rematch" : "Fight again"}
            </Button>
            {ui.net.status === "rematch" && (
              <Button variant="secondary" onClick={() => g?.voteRematch(false)}>
                Decline
              </Button>
            )}
            {ui.net.status !== "rematch" && ui.net.status !== "off" && (
              <Button variant="secondary" onClick={() => g?.leaveRoom()}>
                Leave room
              </Button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
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
