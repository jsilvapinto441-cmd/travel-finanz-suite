// Small helpers for the AI assistant: file parsing and audio recording.
import * as XLSX from "xlsx";
import Papa from "papaparse";

export async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export async function parseSpreadsheetToText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") {
    const text = await file.text();
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
    return (parsed.data as string[][])
      .slice(0, 500)
      .map((r) => r.join(" | "))
      .join("\n");
  }
  // xlsx / xls
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const out: string[] = [];
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sn], {
      defval: "",
    });
    out.push(`# Planilha: ${sn}`);
    if (rows.length === 0) {
      out.push("(vazia)");
      continue;
    }
    const headers = Object.keys(rows[0]);
    out.push(headers.join(" | "));
    for (const r of rows.slice(0, 500)) {
      out.push(headers.map((h) => String(r[h] ?? "")).join(" | "));
    }
  }
  return out.join("\n");
}

export type AudioRecorderHandle = {
  stop: () => Promise<Blob>;
};

export async function startAudioRecorder(): Promise<AudioRecorderHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
  const rec = new MediaRecorder(stream, { mimeType: mime });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  rec.start();
  return {
    stop: () =>
      new Promise((resolve) => {
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: mime }));
        };
        rec.stop();
      }),
  };
}
