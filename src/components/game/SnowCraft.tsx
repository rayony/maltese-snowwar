import {
  Copy,
  Flame,
  Globe,
  Home,
  Leaf,
  Loader2,
  Pause,
  Play,
  QrCode,
  RotateCcw,
  Shield,
  Smartphone,
  Snowflake,
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
import { LANGS, htmlLang, useLang, formatClearTime, type I18nKey, type Lang } from "@/game/i18n";
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
  pickup: null,
};

export function SnowCraft() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<SnowCraftGame | null>(null);
  const { lang, t, setLang } = useLang();
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
  const [live, setLive] = useState(true);

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
      const warm = () => game.warmup();
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
      if (ric) ric(warm, { timeout: 2000 });
      else window.setTimeout(warm, 700);
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
              "pointer-events-none flex items-start justify-between",
              landscapePhone
                ? "gap-1 px-[max(0.35rem,env(safe-area-inset-left))] pr-[max(0.35rem,env(safe-area-inset-right))] pt-[max(0.2rem,env(safe-area-inset-top))]"
                : "gap-2 p-3 sm:p-4 pt-[max(0.5rem,env(safe-area-inset-top))]",
            )}
          >
            <div
              className={cn(
                "pointer-events-auto w-max shrink-0 cursor-pointer select-none rounded-xl bg-ink/70 backdrop-blur-sm",
                landscapePhone ? "px-2 py-1" : "px-2.5 py-1.5",
              )}
              onPointerDown={(e) => {
                e.stopPropagation();
                g?.tapLevelHud();
              }}
            >
              <p
                className={cn(
                  "font-sans font-semibold leading-none tracking-tight whitespace-nowrap",
                  landscapePhone ? "text-xs" : "text-sm sm:text-base",
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
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-tan whitespace-nowrap">
                  {t("godSpeed")}
                </p>
              )}
              {!landscapePhone && (
              <p className="mt-1 text-[11px] leading-none text-ice whitespace-nowrap">
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
            <div className="flex min-w-0 shrink-0 items-start justify-end gap-1.5">
            <div
              className={cn(
                "pointer-events-auto flex cursor-pointer select-none items-center gap-2 rounded-xl bg-ink/70 text-sm tabular-nums backdrop-blur-sm",
                landscapePhone ? "px-2 py-1" : "px-3 py-2",
              )}
              onPointerDown={(e) => {
                e.stopPropagation();
                g?.tapScoreHud();
              }}
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
                compact={landscapePhone || portraitPhone}
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
            </div>
          </header>
        )}

        {playing && (
          <div
            className={cn(
              "mt-auto flex flex-col items-center gap-2",
              landscapePhone
                ? "px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))]"
                : "px-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
            )}
          >
            {ui.pickup?.held && (
              <BigBuffHud
                shots={ui.pickup.shots}
                maxShots={ui.pickup.maxShots}
                life={ui.pickup.life}
                maxLife={ui.pickup.maxLife}
                compact={landscapePhone}
                label={t("pickupHold", {
                  n: ui.pickup.shots,
                  s: Math.max(0, Math.ceil(ui.pickup.life)),
                })}
              />
            )}
            {ui.pickup?.field && (
              <p
                className={cn(
                  "pickup-notice text-center",
                  landscapePhone ? "text-sm" : "text-lg sm:text-xl",
                )}
              >
                {t("pickupBig")}
              </p>
            )}
            {portraitPhone && (
              <p className="flex items-center gap-2 rounded-full bg-ink/75 px-3.5 py-2 text-xs text-surface shadow-md backdrop-blur-sm sm:text-sm">
                <Smartphone className="size-4 rotate-90" aria-hidden />
                {t("rotate")}
              </p>
            )}
            {!portraitPhone && !landscapePhone && (
              <p className="text-center font-sans text-xs text-ink/80 sm:text-sm">
                {versus
                  ? t("hintPvp", { dog: t(myTeam === "green" ? "retriever" : "maltese") })
                  : t("hintAi", { dog: t(myTeam === "green" ? "retriever" : "maltese") })}
              </p>
            )}
          </div>
        )}
      </div>

      {ui.screen === "title" && !live && (
        <TitleBoot t={t} lang={lang} onArm={() => gameRef.current?.armTitleAudio()} />
      )}

      {ui.screen === "title" && live && (
        <div
          className={cn(
            "fixed inset-0 z-50 flex justify-center bg-ink bg-cover bg-center",
            landscapePhone ? "items-center p-2" : "items-stretch p-3 sm:p-4",
          )}
          style={{ backgroundImage: "url(/images/title-bg.jpg?v=3)", touchAction: "manipulation" }}
          onPointerDown={() => gameRef.current?.armTitleAudio()}
        >
          <div className="pointer-events-none absolute inset-0 bg-ink/45" />
          <div
            className={cn(
              "relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-surface/15 bg-ink/80 shadow-xl",
              landscapePhone
                ? "max-h-[calc(100svh-0.7rem)]"
                : "h-full max-h-[min(92dvh,720px)] pb-[env(safe-area-inset-bottom)]",
            )}
          >
            <div className={cn("shrink-0", landscapePhone ? "px-4 pb-1 pt-3" : "px-5 pt-5 sm:px-8 sm:pt-8")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h1
                    lang={htmlLang(lang)}
                    className={cn(
                      "font-title-script leading-snug tracking-tight text-surface",
                      landscapePhone
                        ? "text-[clamp(1.35rem,5.4vw,2.1rem)]"
                        : "text-[clamp(1.7rem,7.2vw,3rem)] sm:text-5xl",
                    )}
                  >
                    {t("gameTitle")}
                  </h1>
                  <p
                    lang={htmlLang(lang)}
                    className={cn(
                      "font-motto-script leading-snug text-[#fff3c4]",
                      landscapePhone
                        ? "mt-0.5 text-[clamp(0.9rem,3.6vw,1.2rem)]"
                        : "mt-1.5 text-[clamp(1.05rem,4.6vw,1.5rem)] sm:text-2xl",
                    )}
                  >
                    {t("slogan")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        gameRef.current?.armTitleAudio();
                        gameRef.current?.toggleMute();
                      }}
                      className="pointer-events-auto inline-flex size-9 items-center justify-center rounded-full border border-surface/30 bg-ink/70 text-[#fff3c4] backdrop-blur-sm hover:bg-ink/90"
                      aria-label={ui.muted ? t("unmute") : t("mute")}
                    >
                      {ui.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                    </button>
                    <LangMenu lang={lang} onChange={setLang} label={t("language")} tone="title" />
                  </div>
                  <div className="flex -space-x-2" aria-hidden>
                    <DogHead src="/sprites/red/idle-1.png" alt="" kind="maltese" className="z-10" />
                    <DogHead src="/sprites/green/idle-1.png" alt="" kind="retriever" />
                  </div>
                </div>
              </div>
            </div>
            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto",
                landscapePhone ? "px-4 py-1" : "px-5 py-3 sm:px-8",
              )}
            >
              {!vsGate && !aiGate && !landscapePhone && (
                <p className="text-sm leading-relaxed text-surface/80">
                  {t("blurb")}
                </p>
              )}
              {aiGate && (
                <div>
                  <h2 className={cn("font-display font-semibold text-surface", landscapePhone ? "text-lg" : "text-2xl sm:text-3xl")}>
                    {t("playVsAi")}
                  </h2>
                  <ol className={cn("mt-2 space-y-1 text-surface/75", landscapePhone ? "text-xs" : "text-sm")}>
                    <li>{t("aiHow1")}</li>
                    <li>{t("aiHow2")}</li>
                    <li>{t("aiHow3")}</li>
                  </ol>
                  {!landscapePhone && (
                    <>
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
                    </>
                  )}
                </div>
              )}
              {vsGate && (
                <div>
                  <h2 className={cn("font-display font-semibold text-surface", landscapePhone ? "text-lg" : "text-2xl sm:text-3xl")}>
                    {t("playVsFriend")}
                  </h2>
                  <p className={cn("mt-2 leading-relaxed text-surface/80", landscapePhone ? "text-xs" : "text-sm")}>
                    {t("vsFriendLead")}
                  </p>
                  {!landscapePhone && (
                    <ul className="mt-2 list-disc space-y-0.5 pl-4 text-sm leading-relaxed text-surface/75">
                      <li>{t("vsRule1")}</li>
                      <li>{t("vsRule2")}</li>
                      <li>{t("vsRule3")}</li>
                      <li>{t("vsRule4")}</li>
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div
              className={cn(
                "relative z-20 shrink-0 border-t border-surface/10 bg-ink/90",
                landscapePhone ? "px-3 py-2.5" : "p-4 sm:p-5",
              )}
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
                <div className="flex flex-col gap-2">
                  <p className="text-center text-[10px] text-ice sm:text-xs">{t("unofficial")}</p>
                  <div className="flex gap-2">
                  <button
                    type="button"
                    data-testid="play-vs-ai"
                    className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-2 text-sm font-medium text-primary-fg shadow-sm [touch-action:manipulation] hover:bg-primary/90 sm:h-12 sm:text-base"
                    onClick={() => setAiGate(true)}
                  >
                    <Play className="size-4 shrink-0" />
                    {t("playVsAi")}
                  </button>
                  <button
                    type="button"
                    data-testid="play-vs-friend"
                    className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#3d8fd4] px-2 text-sm font-medium text-white shadow-sm [touch-action:manipulation] hover:bg-[#347ebd] sm:h-12 sm:text-base"
                    onClick={() => setVsGate(true)}
                  >
                    <Users className="size-4 shrink-0" />
                    {t("playVsFriend")}
                  </button>
                  </div>
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
                  <div className={cn("flex items-center justify-center gap-4 text-[11px]", landscapePhone ? "mt-1" : "mt-3")}>
                    <Link
                      to="/credits"
                      className="text-ice underline decoration-ice/40 underline-offset-2 hover:text-surface"
                    >
                      {t("license")}
                    </Link>
                    <a
                      href="https://github.com/rayony/maltese-snowwar/blob/main/README.md"
                      target="_blank"
                      rel="noreferrer"
                      className="text-ice underline decoration-ice/40 underline-offset-2 hover:text-surface"
                    >
                      {t("readme")}
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
                  {!landscapePhone && (
                    <>
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
                    </>
                  )}
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
            <LangMenu lang={lang} onChange={setLang} label={t("language")} tone="modal" className="w-full" />
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
                <h2 className="mt-2 font-display text-2xl font-semibold max-[500px]:text-xl sm:mt-3 sm:text-3xl">
                  {win ? t("victory") : t("buried")}
                </h2>
                {win && (
                  <p lang={htmlLang(lang)} className="mt-1 font-motto-script text-xl text-pine">{t("slogan")}</p>
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
          <div className="mt-4 flex flex-col gap-2 sm:mt-6">
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
        <p lang={htmlLang(lang)} className="font-title-script text-3xl">{t("gameTitle")}</p>
        <p lang={htmlLang(lang)} className="font-motto-script text-xl text-[#fff3c4] sm:text-2xl">{t("slogan")}</p>
      </div>
    </div>
  );
}

function joinUrl(code: string) {
  if (typeof window === "undefined") return `?vs=${code}`;
  return `${window.location.origin}${window.location.pathname}?vs=${code}`;
}

function BigBuffHud({
  shots,
  maxShots,
  life,
  maxLife,
  compact,
  label,
}: {
  shots: number;
  maxShots: number;
  life: number;
  maxLife: number;
  compact: boolean;
  label: string;
}) {
  const pct = Math.max(0, Math.min(1, maxLife > 0 ? life / maxLife : 0));
  return (
    <div
      className={cn(
        "flex flex-col items-stretch rounded-xl border border-tan/50 bg-ink/80 text-tan shadow-md backdrop-blur-sm",
        compact ? "min-w-28 gap-1 px-2 py-1" : "min-w-36 gap-1.5 px-3 py-2",
      )}
      role="status"
      aria-label={label}
    >
      <div className="flex items-center justify-center gap-1.5">
        <Snowflake className={compact ? "size-3.5" : "size-4"} aria-hidden />
        <div className="flex items-center gap-1">
          {Array.from({ length: maxShots }, (_, i) => (
            <span
              key={i}
              className={cn(
                "rounded-full border border-tan",
                i < shots ? "bg-surface" : "opacity-30",
                compact ? "size-2.5" : "size-3",
              )}
            />
          ))}
        </div>
      </div>
      <div className={cn("overflow-hidden rounded-full bg-ink", compact ? "h-1" : "h-1.5")}>
        <div
          className="h-full rounded-full bg-tan transition-[width] duration-100 ease-linear"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
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
      className="relative size-16 overflow-hidden rounded-full border border-ink/10 bg-[#c5d6e2] shadow-inner max-[500px]:size-14 sm:size-24"
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

function LangMenu({
  lang,
  onChange,
  label,
  tone = "title",
  className,
}: {
  lang: Lang;
  onChange: (l: Lang) => void;
  label: string;
  tone?: "title" | "modal";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btn.current?.getBoundingClientRect();
      if (!r) return;
      setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    };
    place();
    const close = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  const dark = tone === "title";

  return (
    <div
      ref={root}
      className={cn("relative pointer-events-auto", className)}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        ref={btn}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-full border text-xs font-semibold backdrop-blur-sm",
          dark
            ? "size-9 border-surface/30 bg-ink/70 text-[#fff3c4] hover:bg-ink/90"
            : "h-11 w-full border-ink/15 bg-ink/5 px-3 text-ink hover:bg-ink/10",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        <Globe className={dark ? "size-4" : "size-4"} />
        {!dark && <span>{LANGS.find((l) => l.id === lang)?.label ?? "English"}</span>}
      </button>
      {open && (
        <ul
          role="listbox"
          style={
            dark && pos
              ? { position: "fixed", top: pos.top, right: pos.right }
              : undefined
          }
          className={cn(
            "z-50 min-w-40 overflow-y-auto rounded-xl border py-1 shadow-xl",
            "max-h-[min(70dvh,20rem)]",
            !dark && "absolute left-0 right-0 mt-1",
            dark
              ? "border-surface/20 bg-ink/95 text-[#fff3c4]"
              : "border-ink/10 bg-surface text-ink",
          )}
        >
          {LANGS.map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                role="option"
                aria-selected={opt.id === lang}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(opt.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex min-h-11 w-full items-center px-3 py-2.5 text-left text-sm",
                  opt.id === lang
                    ? dark
                      ? "bg-surface/15 font-semibold"
                      : "bg-ink/10 font-semibold"
                    : dark
                      ? "hover:bg-surface/10"
                      : "hover:bg-ink/5",
                )}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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
        "fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-ink/55 px-3 py-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-[2px]",
        appear && "modal-veil",
      )}
    >
      <div
        className={cn(
          "my-auto w-full max-w-sm max-h-[calc(100svh-1rem)] overflow-y-auto rounded-xl border border-surface/15 bg-surface p-4 text-ink shadow-xl sm:p-7",
          appear && "modal-pop",
        )}
      >
        {children}
      </div>
    </div>
  );
}
