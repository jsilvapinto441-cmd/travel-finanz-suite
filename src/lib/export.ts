import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { getBrandName } from "@/lib/brand";

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
export function exportToPDF<T>({
  title,
  subtitle,
  summary,
  columns,
  rows,
  filename,
  orientation = "landscape",
}: {
  title: string;
  subtitle?: string;
  summary?: { label: string; value: string }[];
  columns: ExportColumn<T>[];
  rows: T[];
  filename?: string;
  orientation?: "portrait" | "landscape";
}) {
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Cabeçalho
  doc.setFillColor(15, 15, 15);
  doc.rect(0, 0, pageWidth, 18, "F");
  doc.setTextColor(249, 115, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(getBrandName(), 12, 11);
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
    styles: { fontSize: 9, cellPadding: 2.5, textColor: [30, 30, 30] },
    headStyles: {
      fillColor: [249, 115, 22],
      textColor: [255, 255, 255],
      fontStyle: "bold",
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
}: {
  sheetName?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  filename: string;
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
