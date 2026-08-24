import { Pause, Play, RotateCcw, Shield, Smartphone, Swords, User, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SnowCraftGame } from "@/game/game";
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
};

export function SnowCraft() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<SnowCraftGame | null>(null);
  const [ui, setUi] = useState<UiSnapshot>(INITIAL);
  const [portraitPhone, setPortraitPhone] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new SnowCraftGame(canvas, setUi);
    gameRef.current = game;
    void game.start();
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
                Level {ui.level}
              </p>
              <p className="text-xs text-ice">Best {ui.best}</p>
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
            Hold a Maltese · tap = short toss · hold = far throw · pack snow between throws
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
                {ui.ready ? "Play" : "Loading…"}
              </Button>
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
          <h2 className="font-display text-3xl font-semibold">Buried</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            The retrievers buried you at level {ui.level}. Best {ui.best}.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button size="lg" onClick={() => g?.retry()}>
              <RotateCcw />
              Fight again
            </Button>
          </div>
        </Modal>
      )}
    </div>
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
