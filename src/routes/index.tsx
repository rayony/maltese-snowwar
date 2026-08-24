import { createFileRoute } from "@tanstack/react-router";
import { SnowCraft } from "@/components/game/SnowCraft";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <SnowCraft />;
}
