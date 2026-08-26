import {
  Copy,
  Flame,
  Home,
  Leaf,
  Loader2,
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
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SnowCraftGame } from "@/game/game";
import { normalizeCode } from "@/game/net";
import { useLang, formatClearTime, type I18nKey, type Lang } from "@/game/i18n";
import { APP_COMMIT_URL, APP_VERSION } from "@/game/version";
import type { AllyMode, Team, UiSnapshot } from "@/game/types";
import { cn } from "@/lib/utils";

const INITIAL: UiSnapshot = {
  screen: "title",
  level: 1,
  best: 0,
  clearEasyMs: null,
  clearHardMs: null,
  clearEasyStar: false,
  clearHardStar: false,
  redAlive: 3,
  greenAlive: 3,
  greenTotal: 3,
  muted: false,
  ready: true,
  loadDone: 0,
  loadTotal: 1,
  allyMode: "off",
  difficulty: "easy",
  godSpeed: false,
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
  const { lang, t, toggle, nextLabel } = useLang();
  const [ui, setUi] = useState<UiSnapshot>(INITIAL);
  const [portraitPhone, setPortraitPhone] = useState(false);
  const [landscapePhone, setLandscapePhone] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [vsGate, setVsGate] = useState(false);
  const [aiGate, setAiGate] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const pendingPlay = useRef<"easy" | "hard" | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const boot = window.setTimeout(() => setLive(true), 50);
    const canvas = canvasRef.current;
    if (!canvas) {
      setLive(true);
      return () => window.clearTimeout(boot);
    }
    try {
      const game = new SnowCraftGame(canvas, setUi);
      gameRef.current = game;
      void game.start();
      setLive(true);
      const queued = pendingPlay.current;
      if (queued) {
        pendingPlay.current = null;
        game.play(queued);
      }
      const params = new URLSearchParams(window.location.search);
      const vs = params.get("vs");
      if (vs && normalizeCode(vs).length === 6) {
        window.setTimeout(() => game.joinVersus(vs), 400);
      }
    } catch (err) {
      console.error(err);
      setLive(true);
    }
    return () => {
      window.clearTimeout(boot);
      gameRef.current?.destroy();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const sync = () => {
      const touch =
        window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
      setPortraitPhone(touch && window.innerHeight > window.innerWidth * 1.08);
      setLandscapePhone(touch && window.innerWidth > window.innerHeight * 1.05 && window.innerHeight < 520);
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
    <div className="game-shell relative h-dvh w-full overflow-hidden bg-ink text-surface select-none">
      <canvas
        ref={canvasRef}
        className={cn(
          "absolute inset-0 z-0 size-full touch-none",
          playing || ui.screen === "paused" ? "" : "pointer-events-none",
        )}
        style={{ touchAction: "none" }}
      />

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col text-surface">
        {playing && (
          <header
            className={cn(
              "pointer-events-none flex items-start justify-between gap-2 pt-[max(0.5rem,env(safe-area-inset-top))]",
              landscapePhone ? "px-2 pb-1" : "gap-3 p-3 sm:p-4",
            )}
          >
            <div
              className={cn(
                "pointer-events-auto cursor-pointer select-none rounded-xl bg-ink/70 backdrop-blur-sm",
                landscapePhone ? "px-2 py-1" : "px-3 py-2",
              )}
              onPointerDown={(e) => {
                e.stopPropagation();
                g?.tapLevelHud();
              }}
            >
              <p
                className={cn(
                  "font-sans font-semibold leading-tight tracking-tight",
                  landscapePhone ? "text-sm" : "text-lg",
                )}
              >
                {ui.net.status !== "off" && ui.net.code
                  ? `VS ${ui.net.code}`
                  : ui.net.role !== "solo"
                    ? t("pvpMode")
                    : ui.difficulty === "hard"
                      ? t("levelHard", { n: ui.level })
                      : t("level", { n: ui.level })}
              </p>
              {ui.godSpeed && (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300 sm:text-xs">
                  {t("godSpeed")}
                </p>
              )}
              {!landscapePhone && (
              <p className="text-xs text-ice">
                {ui.net.team === "green"
                  ? t("retrieverTeam")
                  : ui.net.status !== "off"
                    ? t("malteseTeam")
                    : t("bestLevel", { n: ui.best })}
                {ui.net.status !== "off" && ui.net.code
                  ? ui.net.link === "direct"
                    ? ui.net.rttMs != null
                      ? ` · ${ui.net.rttMs}ms`
                      : " · direct"
                    : " · relay"
                  : ""}
                {playing ? ` · ${ui.fps || "–"}fps` : ""}
              </p>
              )}
            </div>
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl bg-ink/70 text-sm tabular-nums backdrop-blur-sm",
                landscapePhone ? "px-2 py-1" : "px-3 py-2",
              )}
            >
              <span className="font-medium text-primary">{ui.redAlive}</span>
              <span className="text-ice">vs</span>
              <span className="font-medium text-tan">{ui.greenAlive}</span>
            </div>
            <div className="pointer-events-auto flex flex-nowrap items-center justify-end gap-1.5">
              <AllyToggle
                mode={ui.allyMode}
                onChange={(m) => g?.setAllyMode(m)}
                t={t}
                compact={landscapePhone}
              />
              <Button
                variant="ghost"
                size="icon"
                className={cn("bg-ink/70 backdrop-blur-sm", landscapePhone && "size-8")}
                aria-label={ui.muted ? t("unmute") : t("mute")}
                onClick={() => g?.toggleMute()}
              >
                {ui.muted ? <VolumeX /> : <Volume2 />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("bg-ink/70 backdrop-blur-sm", landscapePhone && "size-8")}
                aria-label={t("pause")}
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
              {t("rotate")}
            </p>
          </div>
        )}

        {playing && !portraitPhone && !landscapePhone && (
          <p className="mt-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center font-sans text-xs text-ink/80 sm:text-sm">
            {versus
              ? t("hintPvp", { dog: t(myTeam === "green" ? "retriever" : "maltese") })
              : t("hintAi", { dog: t(myTeam === "green" ? "retriever" : "maltese") })}
          </p>
        )}
      </div>

      {ui.screen === "title" && !live && (
        <TitleBoot t={t} lang={lang} onArm={() => gameRef.current?.armTitleAudio()} />
      )}

      {ui.screen === "title" && live && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink bg-cover bg-center p-3 sm:p-4"
          style={{ backgroundImage: "url(/images/title-bg.jpg?v=3)", touchAction: "manipulation" }}
          onPointerDown={() => gameRef.current?.armTitleAudio()}
        >
          <div className="pointer-events-none absolute inset-0 bg-ink/45" />
          <div className="relative z-10 flex h-full max-h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-surface/15 bg-ink/80 shadow-xl">
            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-ice sm:text-xs">
                    {t("greet")}
                  </p>
                  <h1 className="mt-1 font-title-script text-4xl leading-tight tracking-tight text-surface sm:text-5xl">
                    {t("gameTitle")}
                  </h1>
                  <p className="mt-1.5 font-motto-script text-xl leading-tight text-[#fff3c4] sm:text-2xl">
                    {t("slogan")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        gameRef.current?.armTitleAudio();
                        gameRef.current?.toggleMute();
                      }}
                      className="pointer-events-auto rounded-full border border-surface/30 bg-ink/70 p-1.5 text-[#fff3c4] backdrop-blur-sm hover:bg-ink/90"
                      aria-label={ui.muted ? t("unmute") : t("mute")}
                    >
                      {ui.muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                    </button>
                    <LangToggle nextLabel={nextLabel} onToggle={toggle} />
                  </div>
                  <div className="flex -space-x-2" aria-hidden>
                  <DogHead src="/sprites/red/idle-1.png" alt="" kind="maltese" className="z-10" />
                  <DogHead src="/sprites/green/idle-1.png" alt="" kind="retriever" />
                  </div>
                </div>
              </div>
              {!vsGate && !aiGate && (
                <>
                  <p className="mt-3 text-sm leading-relaxed text-surface/80">
                    {t("blurb")}
                  </p>
                </>
              )}
              {aiGate && (
                <div className="mt-3">
                  <h2 className="font-display text-2xl font-semibold text-surface sm:text-3xl">
                    {t("playVsAi")}
                  </h2>
                  <ol className="mt-3 space-y-1 text-sm text-surface/75">
                    <li>{t("aiHow1")}</li>
                    <li>{t("aiHow2")}</li>
                    <li>{t("aiHow3")}</li>
                  </ol>
                  <p className="mt-3 text-sm leading-relaxed text-surface/80">
                    {t("easyBlurb")}
                  </p>
                  <p className="mt-2 text-sm font-medium text-surface/90">{t("hard")}</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm leading-relaxed text-surface/75">
                    <li>{t("hard1")}</li>
                    <li>{t("hard2")}</li>
                    <li>{t("hard3")}</li>
                    <li>{t("hard4")}</li>
                  </ul>
                </div>
              )}
              {vsGate && (
                <div className="mt-3">
                  <h2 className="font-display text-2xl font-semibold text-surface sm:text-3xl">
                    {t("playVsFriend")}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-surface/80">
                    {t("vsFriendLead")}
                  </p>
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-sm leading-relaxed text-surface/75">
                    <li>{t("vsRule1")}</li>
                    <li>{t("vsRule2")}</li>
                    <li>{t("vsRule3")}</li>
                    <li>{t("vsRule4")}</li>
                  </ul>
                </div>
              )}
            </div>
            <div
              className="relative z-20 shrink-0 border-t border-surface/10 bg-ink/90 p-4 sm:p-5"
              style={{ touchAction: "manipulation" }}
            >
              {aiGate ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex gap-2">
                  <button
                    type="button"
                    data-testid="play-easy"
                    className="inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-pine px-3 text-base font-medium text-white shadow-sm [touch-action:manipulation] hover:bg-pine/90"
                    onClick={() => {
                      const g = gameRef.current;
                      if (g) g.play("easy");
                      else pendingPlay.current = "easy";
                    }}
                  >
                    <Leaf className="size-4 shrink-0" />
                    {t("easy")}
                  </button>
                  <button
                    type="button"
                    data-testid="play-hard"
                    className="inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-base font-medium text-primary-fg shadow-sm [touch-action:manipulation] hover:bg-primary/90"
                    onClick={() => {
                      const g = gameRef.current;
                      if (g) g.play("hard");
                      else pendingPlay.current = "hard";
                    }}
                  >
                    <Flame className="size-4 shrink-0" />
                    {t("hard")}
                  </button>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full text-surface"
                    type="button"
                    onClick={() => setAiGate(false)}
                  >
                    {t("back")}
                  </Button>
                </div>
              ) : !vsGate ? (
                <div className="flex flex-col gap-2.5">
                  <p className="text-center text-xs text-ice">{t("unofficial")}</p>
                  <button
                    type="button"
                    data-testid="play-vs-ai"
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-7 text-base font-medium text-primary-fg shadow-sm [touch-action:manipulation] hover:bg-primary/90"
                    onClick={() => setAiGate(true)}
                  >
                    <Play className="size-4 shrink-0" />
                    {t("playVsAi")}
                  </button>
                  <button
                    type="button"
                    data-testid="play-vs-friend"
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#3d8fd4] px-7 text-base font-medium text-white shadow-sm [touch-action:manipulation] hover:bg-[#347ebd]"
                    onClick={() => setVsGate(true)}
                  >
                    <Users className="size-4 shrink-0" />
                    {t("playVsFriend")}
                  </button>
                  {ui.net.error && <p className="text-center text-xs text-primary">{ui.net.error}</p>}
                  {ui.clearEasyMs || ui.clearHardMs ? (
                    <div className="space-y-0.5 text-center text-xs text-ice">
                      {ui.clearEasyMs ? (
                        <p>
                          {t(ui.clearEasyStar ? "topEasyStar" : "topEasy", {
                            t: formatClearTime(ui.clearEasyMs, lang),
                          })}
                        </p>
                      ) : null}
                      {ui.clearHardMs ? (
                        <p>
                          {t(ui.clearHardStar ? "topHardStar" : "topHard", {
                            t: formatClearTime(ui.clearHardMs, lang),
                          })}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    ui.best > 0 && (
                      <p className="text-center text-xs text-ice">{t("bestLevel", { n: ui.best })}</p>
                    )
                  )}
                  <div className="mt-3 flex items-center justify-center gap-4 text-[11px]">
                    <Link
                      to="/credits"
                      className="text-ice underline decoration-ice/40 underline-offset-2 hover:text-surface"
                    >
                      {t("license")}
                    </Link>
                    <a
                      href="/Maltese-Snow-War-Architecture.pdf"
                      download="Architecture.pdf"
                      target="_blank"
                      rel="noreferrer"
                      className="text-ice underline decoration-ice/40 underline-offset-2 hover:text-surface"
                    >
                      {t("architecture")}
                    </a>
                    <a
                      href="https://github.com/rayony/maltese-snowwar"
                      target="_blank"
                      rel="noreferrer"
                      className="text-ice underline decoration-ice/40 underline-offset-2 hover:text-surface"
                    >
                      {t("github")}
                    </a>
                  </div>
                  <p className="mt-3 text-center text-[11px] leading-relaxed text-surface/50">
                    {t("fanTribute")}
                  </p>
                  <p className="mt-1.5 text-center text-[11px] text-surface/55">{t("producedBy")}</p>
                  <a
                    href={APP_COMMIT_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="mx-auto mt-2 block w-fit font-mono text-[10px] tracking-wide text-surface/40 hover:text-ice"
                    title={APP_VERSION}
                  >
                    {APP_VERSION}
                  </a>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <Button
                    size="lg"
                    className="w-full"
                    type="button"
                    data-testid="create-room"
                    onClick={() => gameRef.current?.createVersus()}
                  >
                    <Users />
                    {t("createRoom")}
                  </Button>
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      gameRef.current?.joinVersus(joinCode);
                    }}
                  >
                    <input
                      value={joinCode}
                      onChange={(e) => setJoinCode(normalizeCode(e.target.value))}
                      maxLength={6}
                      placeholder={t("code")}
                      aria-label={t("roomCode")}
                      autoCapitalize="characters"
                      className="h-12 min-w-0 flex-1 rounded-xl border border-surface/20 bg-ink/60 px-3 font-mono text-lg tracking-[0.28em] text-surface placeholder:text-surface/35 select-text"
                    />
                    <Button type="submit" variant="secondary" disabled={joinCode.length !== 6}>
                      {t("join")}
                    </Button>
                  </form>
                  {ui.net.error && <p className="text-center text-xs text-primary">{ui.net.error}</p>}
                  <Button
                    variant="ghost"
                    className="w-full text-surface"
                    type="button"
                    onClick={() => setVsGate(false)}
                  >
                    {t("back")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {ui.screen === "loading" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-surface/15 bg-ink/90 p-6 text-center shadow-xl">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-ice">{t("almost")}</p>
            <h2 className="mt-1 font-display text-3xl font-semibold">{t("stretching")}</h2>
            <p className="mt-2 text-sm text-muted">
              {versus ? t("packingVs") : t("packingAi")}
            </p>
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
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      {ui.screen === "lobby" && (
        <Modal>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">{t("versus")}</p>
          <h2 className="mt-1 font-display text-3xl font-semibold">
            {ui.net.role === "host" ? t("waiting") : t("joining")}
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
                  {copied ? t("copied") : t("copy")}
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
                    {qrOpen ? t("hideQr") : t("showQr")}
                  </Button>
                  {qrOpen && qrData && (
                    <div className="flex flex-col items-center gap-2 rounded-xl bg-ink px-4 py-3">
                      <img
                        src={qrData}
                        alt={`QR code to join room ${ui.net.code}`}
                        className="size-44 rounded-lg bg-surface sm:size-52"
                      />
                      <p className="text-center text-xs text-ice">
                        {t("qrHint")}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {ui.net.role === "host"
              ? t("lobbyHost")
              : ui.net.error
                ? ui.net.error
                : t("lobbyGuest")}
          </p>
          {ui.net.error && ui.net.role === "host" && (
            <p className="mt-2 text-sm text-primary">{ui.net.error}</p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <Button variant="secondary" onClick={() => g?.cancelLobby()}>
              {t("cancel")}
            </Button>
          </div>
        </Modal>
      )}

      {ui.net.status === "disconnect" && (
        <Modal>
          <h2 className="font-display text-3xl font-semibold">{t("friendLeft")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {t("friendLeftBody")}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button size="lg" onClick={() => g?.takeBot()}>
              {t("takeBots")}
            </Button>
            <Button variant="secondary" onClick={() => g?.waitForFriend()}>
              {t("wait")}
            </Button>
            <Button variant="secondary" onClick={() => g?.leaveRoom()}>
              {t("endGame")}
            </Button>
          </div>
        </Modal>
      )}

      {ui.net.status === "connecting" && ui.screen === "playing" && (
        <Modal>
          <h2 className="font-display text-3xl font-semibold">{t("waitingDots")}</h2>
          <p className="mt-2 text-sm text-muted">{t("pausedUntil")}</p>
          <div className="mt-6 flex flex-col gap-2">
            <Button size="lg" onClick={() => g?.takeBot()}>
              {t("takeBots")}
            </Button>
            <Button variant="secondary" onClick={() => g?.leaveRoom()}>
              {t("endGame")}
            </Button>
          </div>
        </Modal>
      )}

      {ui.screen === "paused" && (
        <Modal>
          <h2 className="font-display text-3xl font-semibold">{t("paused")}</h2>
          <p className="mt-2 text-sm text-muted">
            {ui.difficulty === "hard" ? t("levelHard", { n: ui.level }) : t("level", { n: ui.level })}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button
              size="lg"
              className="w-full bg-pine text-white shadow-sm hover:bg-pine/90"
              onClick={() => g?.resume()}
            >
              {t("resume")}
            </Button>
            <Button variant="secondary" onClick={() => g?.retry()}>
              <RotateCcw />
              {t("restart")}
            </Button>
            <Button variant="secondary" onClick={toggle}>
              {nextLabel}
            </Button>
            <Button variant="secondary" onClick={() => g?.toTitle()}>
              <Home />
              {t("title")}
            </Button>
          </div>
        </Modal>
      )}

      {(ui.screen === "gameover" ||
        (ui.net.status === "rematch" && ui.screen !== "playing" && ui.screen !== "loading")) && (
        <Modal appear>
          {(() => {
            const win = ui.net.result === "win";
            return (
              <div className="flex flex-col items-center text-center">
                <ResultMascot win={win} team={ui.net.team} />
                <h2 className="mt-3 font-display text-3xl font-semibold">
                  {win ? t("victory") : t("buried")}
                </h2>
                {win && (
                  <p className="mt-1 font-motto-script text-xl text-pine">{t("slogan")}</p>
                )}
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {versusGameoverCopy(ui, t)}
                </p>
              </div>
            );
          })()}
          {ui.net.rematchTheirs && !ui.net.rematchMine && (
            <p className="mt-3 rounded-lg bg-leaf/30 px-3 py-2 text-sm">
              {t("rematchAsk")}
            </p>
          )}
          {ui.net.rematchMine && !ui.net.rematchTheirs && (
            <p className="mt-3 text-sm text-muted">{t("rematchWait")}</p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <Button
              size="lg"
              onClick={() => (rematchOpen ? g?.voteRematch(true) : g?.retry())}
              disabled={ui.net.rematchMine}
            >
              <RotateCcw />
              {rematchOpen ? t("rematch") : t("fightAgain")}
            </Button>
            {rematchOpen && (
              <Button variant="secondary" onClick={() => g?.voteRematch(false)}>
                {t("decline")}
              </Button>
            )}
            {!rematchOpen && ui.net.status !== "off" && ui.net.code && (
              <Button variant="secondary" onClick={() => g?.leaveRoom()}>
                {t("leaveRoom")}
              </Button>
            )}
            {ui.net.status === "off" && (
              <Button variant="secondary" onClick={() => g?.toTitle()}>
                <Home />
                {t("title")}
              </Button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

type TFn = (key: I18nKey, vars?: Record<string, string | number>) => string;

function TitleBoot({ t, lang, onArm }: { t: TFn; lang: Lang; onArm?: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink bg-cover bg-center"
      style={{ backgroundImage: "url(/images/title-bg.jpg?v=3)" }}
      aria-busy="true"
      aria-live="polite"
      onPointerDown={() => onArm?.()}
    >
      <div className="absolute inset-0 bg-ink/50" />
      <div className="relative flex flex-col items-center gap-4 text-surface">
        <Loader2 className="size-10 animate-spin text-ice" aria-hidden />
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-ice">{t("loading")}</p>
        <p className="font-title-script text-3xl">{t("gameTitle")}</p>
        <p className="font-motto-script text-xl text-[#fff3c4] sm:text-2xl">{t("slogan")}</p>
      </div>
    </div>
  );
}

function joinUrl(code: string) {
  if (typeof window === "undefined") return `?vs=${code}`;
  return `${window.location.origin}${window.location.pathname}?vs=${code}`;
}

function versusGameoverCopy(ui: UiSnapshot, t: TFn) {
  if (ui.net.result === "win") {
    if (ui.net.status === "off" || ui.net.role === "solo") {
      return t("winSolo", { n: ui.level });
    }
    return ui.net.team === "green" ? t("winGuest") : t("winHost");
  }
  if (ui.net.status === "rematch" || ui.net.role !== "solo") {
    return ui.net.team === "green" ? t("loseGuest") : t("loseHost");
  }
  return t("loseSolo", { n: ui.level, best: ui.best });
}

function ResultMascot({ win, team }: { win: boolean; team: Team }) {
  const side = team === "green" ? "green" : "red";
  const kind = team === "green" ? "retriever" : "maltese";
  const dance = [1, 2, 3, 4].map((i) => `/sprites/${side}/dance-${i}.png`);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!win) return;
    const id = window.setInterval(() => setFrame((f) => (f + 1) % 4), 140);
    return () => window.clearInterval(id);
  }, [win, side]);
  const src = win ? dance[frame]! : `/sprites/fx/buried-${side}.png?v=3`;
  return (
    <span
      className="relative size-24 overflow-hidden rounded-full border border-ink/10 bg-[#c5d6e2] shadow-inner sm:size-28"
      aria-hidden
    >
      <img
        src={src}
        alt=""
        className={cn(
          "pointer-events-none absolute left-1/2 max-w-none -translate-x-1/2 select-none object-cover",
          win
            ? kind === "retriever"
              ? "top-[-2%] h-[150%] w-[150%] object-[50%_12%]"
              : "top-[-6%] h-[165%] w-[165%] object-[50%_8%]"
            : "top-[8%] h-[110%] w-[110%] object-[50%_70%]",
        )}
      />
    </span>
  );
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

function LangToggle({
  nextLabel,
  onToggle,
  className,
}: {
  nextLabel: string;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "pointer-events-auto rounded-full border border-surface/30 bg-ink/70 px-3 py-1 text-xs font-semibold tracking-wide text-[#fff3c4] backdrop-blur-sm hover:bg-ink/90",
        className,
      )}
      aria-label={`Switch language (next: ${nextLabel})`}
    >
      {nextLabel}
    </button>
  );
}

function AllyToggle({
  mode,
  onChange,
  t,
  compact = false,
}: {
  mode: AllyMode;
  onChange: (m: AllyMode) => void;
  t: TFn;
  compact?: boolean;
}) {
  const opts: { id: AllyMode; label: string; icon: ReactNode }[] = [
    { id: "off", label: t("allyManual"), icon: <User /> },
    { id: "defend", label: t("allyDefend"), icon: <Shield /> },
    { id: "attack", label: t("allyAttack"), icon: <Swords /> },
  ];
  return (
    <div
      className="flex rounded-xl bg-ink/70 p-1 backdrop-blur-sm"
      role="group"
      aria-label={t("allyLabel")}
    >
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg font-medium",
            compact ? "px-1.5 py-1" : "px-2 py-1.5 text-[11px] sm:px-2.5 sm:text-xs",
            mode === o.id ? "bg-surface text-ink shadow-sm" : "text-surface/80 hover:text-surface",
          )}
          aria-pressed={mode === o.id}
        >
          {o.icon}
          <span className={compact ? "sr-only" : "hidden sm:inline"}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function Modal({ children, appear }: { children: ReactNode; appear?: boolean }) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center bg-ink/55 p-4 backdrop-blur-[2px]",
        appear && "modal-veil",
      )}
    >
      <div
        className={cn(
          "w-full max-w-sm rounded-xl border border-surface/15 bg-surface p-6 text-ink shadow-xl sm:p-7",
          appear && "modal-pop",
        )}
      >
        {children}
      </div>
    </div>
  );
}
