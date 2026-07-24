import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { getBrandLogo, getBrandName } from "@/lib/brand";

async function loadLogoDataUrl(url: string): Promise<{ dataUrl: string; format: "PNG" | "JPEG" | "WEBP"; w: number; h: number } | null> {
  try {
    let dataUrl: string;
    let mime = "image/png";
    if (url.startsWith("data:")) {
      dataUrl = url;
      mime = url.slice(5, url.indexOf(";")) || mime;
    } else {
      const res = await fetch(url, { mode: "cors" });
      const blob = await res.blob();
      mime = blob.type || mime;
      dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(blob);
      });
    }
    const { w, h } = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    const format: "PNG" | "JPEG" | "WEBP" =
      mime.includes("jpeg") || mime.includes("jpg") ? "JPEG"
      : mime.includes("webp") ? "WEBP" : "PNG";
    return { dataUrl, format, w, h };
  } catch {
    return null;
  }
}


export type ExportColumn<T> = {
  header: string;
  /** Field key on the row OR a function returning a stringifiable value. */
  accessor: keyof T | ((row: T) => string | number | null | undefined);
  /** Optional column width hint in PDF (in mm). */
  width?: number;
};

function getCellValue<T>(row: T, col: ExportColumn<T>): string {
  const v =
    typeof col.accessor === "function"
      ? col.accessor(row)
      : (row as any)[col.accessor];
  if (v === null || v === undefined) return "";
  return String(v);
}

function sanitize(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .toLowerCase();
}

function timestamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** Exporta uma tabela genérica para PDF (paisagem, com cabeçalho laranja). */
export async function exportToPDF<T>({
  title,
  subtitle,
  summary,
  filters,
  columns,
  rows,
  filename,
  orientation = "landscape",
  logoUrl,
}: {
  title: string;
  subtitle?: string;
  summary?: { label: string; value: string }[];
  filters?: { label: string; value: string }[];
  columns: ExportColumn<T>[];
  rows: T[];
  filename?: string;
  orientation?: "portrait" | "landscape";
  logoUrl?: string | null;
}) {
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  const resolvedLogo = logoUrl ?? getBrandLogo();
  const logo = resolvedLogo ? await loadLogoDataUrl(resolvedLogo) : null;

  // Cabeçalho
  doc.setFillColor(15, 15, 15);
  doc.rect(0, 0, pageWidth, 18, "F");

  let textStartX = 12;
  if (logo) {
    const imgH = 12;
    const imgW = Math.min(24, (logo.w / logo.h) * imgH);
    try {
      doc.addImage(logo.dataUrl, logo.format, 8, 3, imgW, imgH);
      textStartX = 8 + imgW + 4;
    } catch {
      // fallback: ignora logo se formato não suportado
    }
  }

  doc.setTextColor(249, 115, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(getBrandName(), textStartX, 11);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")}`,
    pageWidth - 12,
    11,
    { align: "right" },
  );


  // Título
  doc.setTextColor(15, 15, 15);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 12, 28);
  let cursorY = 34;
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, 12, cursorY);
    cursorY += 6;
  }

  // Bloco de filtros aplicados
  const activeFilters = (filters ?? []).filter((f) => f.value && f.value.trim() !== "");
  if (activeFilters.length > 0) {
    const lineH = 5;
    const boxH = 6 + activeFilters.length * lineH;
    doc.setFillColor(255, 250, 244);
    doc.setDrawColor(249, 115, 22);
    doc.roundedRect(10, cursorY, pageWidth - 20, boxH, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(249, 115, 22);
    doc.text("FILTROS APLICADOS", 14, cursorY + 4);
    activeFilters.forEach((f, i) => {
      const y = cursorY + 4 + (i + 1) * lineH;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text(`${f.label}:`, 14, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(20, 20, 20);
      doc.text(f.value, 14 + doc.getTextWidth(`${f.label}:`) + 2, y);
    });
    cursorY += boxH + 4;
  }

  // Bloco de totais / resumo
  if (summary && summary.length > 0) {
    const boxH = 14;
    const boxY = cursorY;
    doc.setFillColor(249, 246, 241);
    doc.setDrawColor(249, 115, 22);
    doc.roundedRect(10, boxY, pageWidth - 20, boxH, 1.5, 1.5, "FD");
    const colW = (pageWidth - 20) / summary.length;
    summary.forEach((item, i) => {
      const x = 10 + i * colW + 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(item.label.toUpperCase(), x, boxY + 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(20, 20, 20);
      doc.text(item.value, x, boxY + 11);
    });
    cursorY = boxY + boxH + 4;
  }

  const head = [columns.map((c) => c.header)];
  const body = rows.map((row) => columns.map((c) => getCellValue(row, c)));

  autoTable(doc, {
    head,
    body,
    startY: cursorY,
    styles: { fontSize: 7, cellPadding: 1.5, textColor: [30, 30, 30] },
    headStyles: {
      fillColor: [249, 115, 22],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    margin: { left: 10, right: 10 },
  });


  doc.save(`${sanitize(filename ?? title)}_${timestamp()}.pdf`);
}

/** Exporta uma tabela genérica para Excel (.xlsx). */
export function exportToExcel<T>({
  sheetName = "Dados",
  columns,
  rows,
  filename,
  subtitle,
  summary,
  filters,
}: {
  sheetName?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  filename: string;
  subtitle?: string;
  summary?: { label: string; value: string }[];
  filters?: { label: string; value: string }[];
}) {
  const headers = columns.map((c) => c.header);
  const data = rows.map((row) => {
    const obj: Record<string, string> = {};
    for (const c of columns) obj[c.header] = getCellValue(row, c);
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(data, { header: headers });
  ws["!cols"] = columns.map((c) => {
    const maxLen = Math.max(
      c.header.length,
      ...rows.map((r) => getCellValue(r, c).length),
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
  });

  // Anexa filtros / subtítulo / resumo ao final da planilha
  const activeFilters = (filters ?? []).filter((f) => f.value && f.value.trim() !== "");
  if (activeFilters.length > 0 || (summary && summary.length > 0) || subtitle) {
    const extras: (string | number)[][] = [[]];
    if (subtitle) extras.push([subtitle]);
    if (activeFilters.length > 0) {
      extras.push(["Filtros aplicados"]);
      for (const f of activeFilters) extras.push([f.label, f.value]);
      extras.push([]);
    }
    if (summary && summary.length > 0) {
      extras.push(["Resumo"]);
      for (const item of summary) extras.push([item.label, item.value]);
    }
    XLSX.utils.sheet_add_aoa(ws, extras, { origin: -1 });
  }

  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: filename,
    Subject: sheetName,
    Author: getBrandName(),
    Company: getBrandName(),
    CreatedDate: new Date(),
  };
  const safeSheet = (sheetName || "Dados")
    .replace(/[\\/?*[\]:]/g, " ")
    .slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, safeSheet);

  // Gera bytes reais do XLSX e faz download via Blob (MIME correto),
  // evitando problemas de corrupção em alguns navegadores/bundlers.
  const wbout = XLSX.write(wb, {
    bookType: "xlsx",
    type: "array",
    compression: true,
  }) as ArrayBuffer;
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitize(filename)}_${timestamp()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
