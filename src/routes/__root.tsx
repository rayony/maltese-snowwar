import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";
import iosHudCss from "../ios-hud.css?url";

const APP_NAME = "Maltese Snow War";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#15202B" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "mobile-web-app-capable", content: "yes" },
      {
        name: "description",
        content: "Maltese Snow War. Hold a Maltese, dodge, and throw. A remake of the classic snowball fight.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: iosHudCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preload", href: "/images/title-bg.jpg?v=3", as: "image" },
      { rel: "preload", href: "/fonts/Caveat-script.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "preload", href: "/sprites/red/idle-1.png?v=9", as: "image" },
      { rel: "preload", href: "/sprites/green/idle-1.png?v=9", as: "image" },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <IosVisualViewport />
        <DeferredUiFonts />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});

function DeferredUiFonts() {
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (document.getElementById("ui-fonts")) return;
      const l = document.createElement("link");
      l.id = "ui-fonts";
      l.rel = "stylesheet";
      l.href =
        "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;600;700&family=Outfit:wght@400;500;600&display=swap";
      document.head.appendChild(l);
    }, 1600);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}

/** Keep the in-game HUD inside iPhone Safari's visible viewport (QR join / first paint). */
function IosVisualViewport() {
  useEffect(() => {
    const apply = () => {
      const vv = window.visualViewport;
      const top = vv ? Math.max(0, Math.round(vv.offsetTop)) : 0;
      const left = vv ? Math.max(0, Math.round(vv.offsetLeft)) : 0;
      const vh = vv?.height ?? window.innerHeight;
      const vw = vv?.width ?? window.innerWidth;
      const bottom = Math.max(0, Math.round(window.innerHeight - top - vh));
      const right = Math.max(0, Math.round(window.innerWidth - left - vw));
      const root = document.documentElement;
      root.style.setProperty("--vv-top", `${top}px`);
      root.style.setProperty("--vv-left", `${left}px`);
      root.style.setProperty("--vv-bottom", `${bottom}px`);
      root.style.setProperty("--vv-right", `${right}px`);
      window.scrollTo(0, 0);
    };
    apply();
    const delayed = [50, 200, 500, 1000].map((ms) => window.setTimeout(apply, ms));
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    window.addEventListener("pageshow", apply);
    window.visualViewport?.addEventListener("resize", apply);
    window.visualViewport?.addEventListener("scroll", apply);
    return () => {
      delayed.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      window.removeEventListener("pageshow", apply);
      window.visualViewport?.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("scroll", apply);
    };
  }, []);
  return null;
}
