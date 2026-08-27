import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "Maltese Snow War";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#15202B" },
      {
        name: "description",
        content: "Maltese Snow War. Hold a Maltese, dodge, and throw. A remake of the classic snowball fight.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preload", href: "/images/title-bg.jpg?v=3", as: "image" },
      { rel: "preload", href: "/fonts/Caveat-script.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "preload", href: "/sprites/red/idle-1.png?v=5", as: "image" },
      { rel: "preload", href: "/sprites/green/idle-1.png?v=5", as: "image" },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
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
