import { createFileRoute } from "@tanstack/react-router";
import { SnowCraft } from "@/components/game/SnowCraft";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Home,
  pendingComponent: TitleSplash,
});

function TitleSplash() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-ink bg-cover bg-center"
      style={{ backgroundImage: "url(/images/title-bg.jpg?v=3)" }}
    >
      <div className="absolute inset-0 bg-ink/45" />
      <p className="relative font-display text-2xl text-surface">Maltese Snow War</p>
    </div>
  );
}

function Home() {
  return <SnowCraft />;
}
