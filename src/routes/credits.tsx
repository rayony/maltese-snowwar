import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/credits")({
  head: () => ({
    meta: [{ title: "Credits & licenses · Maltese Snow War" }],
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
  {
    name: "React",
    license: "MIT",
    href: "https://github.com/facebook/react",
    use: "UI",
  },
  {
    name: "@tanstack/react-router",
    license: "MIT",
    href: "https://github.com/TanStack/router",
    use: "Routing",
  },
  {
    name: "@tanstack/react-start",
    license: "MIT",
    href: "https://github.com/TanStack/router",
    use: "App server / SSR",
  },
  {
    name: "Vite",
    license: "MIT",
    href: "https://github.com/vitejs/vite",
    use: "Build",
  },
  {
    name: "Tailwind CSS",
    license: "MIT",
    href: "https://github.com/tailwindlabs/tailwindcss",
    use: "Styles",
  },
  {
    name: "lucide-react",
    license: "ISC",
    href: "https://github.com/lucide-icons/lucide",
    use: "Icons",
  },
  {
    name: "qrcode",
    license: "MIT",
    href: "https://github.com/soldair/node-qrcode",
    use: "Room-share QR",
  },
  {
    name: "class-variance-authority",
    license: "Apache-2.0",
    href: "https://github.com/joe-bell/cva",
    use: "Button variants",
  },
  {
    name: "clsx + tailwind-merge",
    license: "MIT",
    href: "https://github.com/lukeed/clsx",
    use: "Class names",
  },
  {
    name: "@radix-ui/react-slot",
    license: "MIT",
    href: "https://github.com/radix-ui/primitives",
    use: "Button asChild",
  },
  {
    name: "zod",
    license: "MIT",
    href: "https://github.com/colinhacks/zod",
    use: "Message validation",
  },
];

const INFRA: Lib[] = [
  {
    name: "better-auth",
    license: "MIT",
    href: "https://github.com/better-auth/better-auth",
    use: "Scaffold auth (unused for play)",
  },
  {
    name: "@electric-sql/pglite",
    license: "Apache-2.0",
    href: "https://github.com/electric-sql/pglite",
    use: "In-memory Postgres in preview",
  },
  {
    name: "kysely",
    license: "MIT",
    href: "https://github.com/kysely-org/kysely",
    use: "SQL query builder",
  },
  {
    name: "pg",
    license: "MIT",
    href: "https://github.com/brianc/node-postgres",
    use: "Postgres client",
  },
  {
    name: "jose",
    license: "MIT",
    href: "https://github.com/panva/jose",
    use: "JWT helpers",
  },
];

const FONTS: Lib[] = [
  {
    name: "Fraunces",
    license: "OFL-1.1",
    href: "https://fonts.google.com/specimen/Fraunces",
    use: "Display type",
  },
  {
    name: "Outfit",
    license: "OFL-1.1",
    href: "https://fonts.google.com/specimen/Outfit",
    use: "UI type",
  },
];

function Table({ rows }: { rows: Lib[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-ink/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-ink/5 text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Library</th>
            <th className="px-3 py-2 font-medium">License</th>
            <th className="px-3 py-2 font-medium">Used for</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-ink/10">
              <td className="px-3 py-2">
                <a href={r.href} target="_blank" rel="noreferrer" className="text-[#2b6ea3] underline underline-offset-2">
                  {r.name}
                </a>
              </td>
              <td className="px-3 py-2 font-mono text-xs">{r.license}</td>
              <td className="px-3 py-2 text-muted">{r.use}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CreditsPage() {
  return (
    <main className="min-h-dvh bg-[#d7e4ee] px-4 py-10 text-ink">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#2b6ea3]">Maltese Snow War</p>
        <h1 className="mt-1 font-display text-4xl font-semibold">Credits & licenses</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          This app only uses permissive open-source licenses (MIT, Apache-2.0, ISC, OFL). None of
          the shipped libraries are copyleft (GPL/AGPL). Apache-2.0 notices are preserved via the
          upstream packages; we do not modify those files. This page is attribution, not legal
          advice.
        </p>

        <h2 className="mt-8 font-display text-2xl font-semibold">Creative tribute</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
          <li>
            Gameplay after{" "}
            <a className="text-[#2b6ea3] underline underline-offset-2" href="https://archive.org/details/snowcraft_201912" target="_blank" rel="noreferrer">
              SnowCraft
            </a>{" "}
            by Nicholson NY (1998). Unofficial fan work.
          </li>
          <li>
            Dogs inspired by 線條小狗, illustrated by{" "}
            <a className="text-[#2b6ea3] underline underline-offset-2" href="https://www.instagram.com/moonlab_studio/" target="_blank" rel="noreferrer">
              moonlab
            </a>
            .
          </li>
          <li>
            Fight feel referenced{" "}
            <a className="text-[#2b6ea3] underline underline-offset-2" href="https://github.com/jeffreywilbur/snowcraftjs" target="_blank" rel="noreferrer">
              snowcraftjs
            </a>{" "}
            by jeffreywilbur (MIT unless noted in that repo).
          </li>
        </ul>

        <h2 className="mt-8 font-display text-2xl font-semibold">Game stack</h2>
        <p className="mt-2 mb-3 text-sm text-muted">Libraries this remake actually imports.</p>
        <Table rows={GAME} />

        <h2 className="mt-8 font-display text-2xl font-semibold">Fonts</h2>
        <div className="mt-3">
          <Table rows={FONTS} />
        </div>

        <h2 className="mt-8 font-display text-2xl font-semibold">Host / scaffold</h2>
        <p className="mt-2 mb-3 text-sm text-muted">
          Shipped with the Grok app template. Extra Radix UI packages may be present in
          package.json but are not imported by this game.
        </p>
        <Table rows={INFRA} />

        <p className="mt-8 text-sm text-muted">
          Full license texts live in each package under{" "}
          <span className="font-mono">{`node_modules/<name>/LICENSE`}</span>.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex h-11 items-center rounded-xl bg-ink px-5 text-sm font-medium text-surface hover:bg-ink/90"
        >
          Back to the yard
        </Link>
      </div>
    </main>
  );
}
