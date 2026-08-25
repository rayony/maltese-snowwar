import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createFileRoute } from "@tanstack/react-router";

async function GET() {
  const file = join(process.cwd(), "public", "Maltese-Snow-War-Architecture.pdf");
  const buf = await readFile(file);
  return new Response(buf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="Maltese-Snow-War-Architecture.pdf"',
      "Cache-Control": "no-store",
    },
  });
}

export const Route = createFileRoute("/api/architecture")({
  server: { handlers: { GET } },
});
