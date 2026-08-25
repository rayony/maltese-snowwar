import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/credits")({
  head: () => ({
    meta: [{ title: "Credits · Maltese Snow War" }],
  }),
  component: CreditsPage,
});

type Lib = {
  name: string;
  license: string;
  href: string;
  use: string;
};

const GAME: Lib[] = [
  { name: "React", license: "MIT", href: "https://github.com/facebook/react", use: "UI" },
  { name: "@tanstack/react-router", license: "MIT", href: "https://github.com/TanStack/router", use: "Routing" },
  { name: "@tanstack/react-start", license: "MIT", href: "https://github.com/TanStack/router", use: "App server" },
  { name: "Vite", license: "MIT", href: "https://github.com/vitejs/vite", use: "Build" },
  { name: "Tailwind CSS", license: "MIT", href: "https://github.com/tailwindlabs/tailwindcss", use: "Styles" },
  { name: "lucide-react", license: "ISC", href: "https://github.com/lucide-icons/lucide", use: "Icons" },
  { name: "qrcode", license: "MIT", href: "https://github.com/soldair/node-qrcode", use: "Room QR" },
  { name: "class-variance-authority", license: "Apache-2.0", href: "https://github.com/joe-bell/cva", use: "Buttons" },
  { name: "clsx + tailwind-merge", license: "MIT", href: "https://github.com/lukeed/clsx", use: "Class names" },
  { name: "@radix-ui/react-slot", license: "MIT", href: "https://github.com/radix-ui/primitives", use: "Button slot" },
  { name: "zod", license: "MIT", href: "https://github.com/colinhacks/zod", use: "Validation" },
];

const INFRA: Lib[] = [
  { name: "better-auth", license: "MIT", href: "https://github.com/better-auth/better-auth", use: "Scaffold auth" },
  { name: "@electric-sql/pglite", license: "Apache-2.0", href: "https://github.com/electric-sql/pglite", use: "Preview DB" },
  { name: "kysely", license: "MIT", href: "https://github.com/kysely-org/kysely", use: "SQL" },
  { name: "pg", license: "MIT", href: "https://github.com/brianc/node-postgres", use: "Postgres" },
  { name: "jose", license: "MIT", href: "https://github.com/panva/jose", use: "JWT" },
];

const FONTS: Lib[] = [
  { name: "Fraunces", license: "OFL-1.1", href: "https://fonts.google.com/specimen/Fraunces", use: "Display" },
  { name: "Outfit", license: "OFL-1.1", href: "https://fonts.google.com/specimen/Outfit", use: "UI type" },
];

const linkCls =
  "text-ice underline decoration-ice/40 underline-offset-2 hover:text-surface";

function LibList({ rows }: { rows: Lib[] }) {
  return (
    <ul className="divide-y divide-surface/10 rounded-xl border border-surface/10 bg-ink/40">
      {rows.map((r) => (
        <li key={r.name} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2 text-sm">
          <a href={r.href} target="_blank" rel="noreferrer" className={linkCls}>
            {r.name}
          </a>
          <span className="text-xs text-surface/55">
            <span className="font-mono text-ice/90">{r.license}</span>
            <span className="mx-1.5 text-surface/25">·</span>
            {r.use}
          </span>
        </li>
      ))}
    </ul>
  );
}

function DogHead({ src, kind }: { src: string; kind: "maltese" | "retriever" }) {
  return (
    <span className="relative size-12 overflow-hidden rounded-full border border-surface/25 bg-[#c5d6e2]">
      <img
        src={src}
        alt=""
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

function CreditsPage() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink bg-cover bg-center p-3 sm:p-4"
      style={{ backgroundImage: "url(/images/title-bg.jpg?v=3)" }}
    >
      <div className="pointer-events-none absolute inset-0 bg-ink/45" />
      <div className="relative z-10 my-auto flex w-full max-w-lg max-h-[min(92dvh,720px)] flex-col overflow-hidden rounded-xl border border-surface/15 bg-ink/80 text-surface shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-surface/10 p-4 sm:px-6">
          <Button asChild variant="ghost" className="text-surface">
            <Link to="/">
              <ArrowLeft />
              Back
            </Link>
          </Button>
          <div className="flex shrink-0 -space-x-2" aria-hidden>
            <DogHead src="/sprites/red/idle-1.png" kind="maltese" />
            <DogHead src="/sprites/green/idle-1.png" kind="retriever" />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-ice sm:text-xs">
            Season's Greetings
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Credits
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-surface/80">
            Fan tribute (二次創作). Only permissive licenses (MIT, Apache-2.0, ISC, OFL) — no
            GPL/AGPL. Apache packages are used unmodified.
          </p>

          <h2 className="mt-6 font-display text-xl font-semibold">Tribute</h2>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed text-surface/80">
            <li>
              Gameplay after{" "}
              <a className={linkCls} href="https://archive.org/details/snowcraft_201912" target="_blank" rel="noreferrer">
                SnowCraft
              </a>{" "}
              by Nicholson NY (1998).
            </li>
            <li>
              Dogs inspired by 線條小狗, illustrated by{" "}
              <a className={linkCls} href="https://www.instagram.com/moonlab_studio/" target="_blank" rel="noreferrer">
                moonlab
              </a>
              .
            </li>
            <li>
              Fight feel referenced{" "}
              <a className={linkCls} href="https://github.com/jeffreywilbur/snowcraftjs" target="_blank" rel="noreferrer">
                snowcraftjs
              </a>{" "}
              by jeffreywilbur.
            </li>
          </ul>

          <h2 className="mt-6 font-display text-xl font-semibold">Game stack</h2>
          <p className="mt-1 mb-2 text-xs text-surface/55">Libraries this remake imports.</p>
          <LibList rows={GAME} />

          <h2 className="mt-6 font-display text-xl font-semibold">Fonts</h2>
          <div className="mt-2">
            <LibList rows={FONTS} />
          </div>

          <h2 className="mt-6 font-display text-xl font-semibold">Host</h2>
          <p className="mt-1 mb-2 text-xs text-surface/55">Grok app template. Extra Radix packages in package.json are unused.</p>
          <LibList rows={INFRA} />
        </div>
        <div className="shrink-0 border-t border-surface/10 p-4 sm:p-5">
          <Button asChild size="lg" variant="secondary" className="w-full">
            <Link to="/">
              <ArrowLeft />
              Back to title
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
