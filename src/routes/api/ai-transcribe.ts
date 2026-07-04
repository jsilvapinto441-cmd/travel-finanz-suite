import { createFileRoute } from "@tanstack/react-router";
import { LOVABLE_AI_BASE, getLovableApiKey } from "@/lib/ai/gateway.server";

export const Route = createFileRoute("/api/ai-transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const inbound = await request.formData();
        const file = inbound.get("file");
        if (!(file instanceof File)) {
          return new Response("Arquivo de áudio ausente.", { status: 400 });
        }
        const mime = file.type || "audio/webm";
        const extMap: Record<string, string> = {
          "audio/webm": "webm",
          "audio/mp4": "m4a",
          "audio/mpeg": "mp3",
          "audio/wav": "wav",
          "audio/x-wav": "wav",
          "audio/ogg": "ogg",
        };
        const ext = extMap[mime.split(";")[0]] ?? "webm";

        const upstream = new FormData();
        upstream.append("model", "openai/gpt-4o-mini-transcribe");
        upstream.append("file", file, `audio.${ext}`);

        const res = await fetch(`${LOVABLE_AI_BASE}/audio/transcriptions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${getLovableApiKey()}` },
          body: upstream,
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          return new Response(`Falha na transcrição: ${t || res.statusText}`, {
            status: res.status,
          });
        }
        const data = (await res.json()) as { text?: string };
        return Response.json({ text: data.text ?? "" });
      },
    },
  },
});
