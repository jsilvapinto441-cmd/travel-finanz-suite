import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/lib/format";
import { getBrandName } from "@/lib/brand";
import { formatPeriodoLabel } from "@/lib/format";

type Periodo = { from?: string; to?: string };

export type RelatorioGerencialData = {
  empresaNome: string;
  missaoNome?: string;
  periodo: Periodo;

  kpis: {
    totalContratado: number;
    totalRecebido: number;
    totalEmAberto: number;
    totalVencido: number;
    inadimplencia: number;
    totalOperacional: number;
    folhaMensal: number;
    totalDespesa: number;
    despesasPagas: number;
    lucro: number;
    qtdAtrasados: number;
  };
  fluxoMensal: { label: string; entradas: number; saidas: number }[];
  despesasCategoria: { name: string; value: number }[];
  empresasLucro?: {
    nome: string;
    receita_realizada: number;
    despesa_realizada: number;
    lucro_realizado: number;
    lucro_projetado: number;
  }[];
};

const BRAND_ORANGE: [number, number, number] = [249, 115, 22];
const BRAND_DARK: [number, number, number] = [15, 15, 15];

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

function headerBar(doc: jsPDF, title: string, subtitle: string) {
  const brand = getBrandName();
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, w, 22, "F");
  doc.setTextColor(...BRAND_ORANGE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(brand, 12, 13);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(title, 12, 19);
  doc.text(subtitle, w - 12, 13, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, w - 12, 19, { align: "right" });
}

function footer(doc: jsPDF) {
  const brand = getBrandName();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `${brand} · Relatório Gerencial · página ${i} de ${pages}`,
      w / 2,
      h - 6,
      { align: "center" },
    );
  }
}

function kpiBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  hint?: string,
  accent: [number, number, number] = BRAND_ORANGE,
) {
  doc.setDrawColor(225, 225, 225);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
  doc.setFillColor(...accent);
  doc.rect(x, y, 2, h, "F");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "normal");
  doc.text(label.toUpperCase(), x + 5, y + 5);
  doc.setFontSize(13);
  doc.setTextColor(...BRAND_DARK);
  doc.setFont("helvetica", "bold");
  doc.text(value, x + 5, y + 12);
  if (hint) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140, 140, 140);
    doc.text(hint, x + 5, y + h - 3);
  }
}

function barChart(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  data: { label: string; entradas: number; saidas: number }[],
) {
  doc.setDrawColor(225, 225, 225);
  doc.setFillColor(252, 252, 252);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");

  if (!data.length) return;
  const padL = 12, padR = 6, padT = 8, padB = 14;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const maxV = Math.max(1, ...data.flatMap((d) => [d.entradas, d.saidas]));
  const groupW = chartW / data.length;
  const barW = Math.min(8, (groupW - 4) / 2);

  // grid
  doc.setDrawColor(235, 235, 235);
  for (let i = 0; i <= 4; i++) {
    const gy = y + padT + (chartH * i) / 4;
    doc.line(x + padL, gy, x + padL + chartW, gy);
    const v = maxV * (1 - i / 4);
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text(`R$${Math.round(v / 1000)}k`, x + padL - 1, gy + 1.5, { align: "right" });
  }

  data.forEach((d, i) => {
    const gx = x + padL + i * groupW + (groupW - barW * 2 - 2) / 2;
    const he = (d.entradas / maxV) * chartH;
    const hs = (d.saidas / maxV) * chartH;
    doc.setFillColor(...BRAND_ORANGE);
    doc.rect(gx, y + padT + chartH - he, barW, he, "F");
    doc.setFillColor(212, 175, 55);
    doc.rect(gx + barW + 2, y + padT + chartH - hs, barW, hs, "F");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(d.label, gx + barW + 1, y + h - 4, { align: "center" });
  });

  // legenda
  doc.setFontSize(7);
  doc.setFillColor(...BRAND_ORANGE);
  doc.rect(x + padL, y + 2, 3, 3, "F");
  doc.setTextColor(80, 80, 80);
  doc.text("Entradas", x + padL + 5, y + 4.5);
  doc.setFillColor(212, 175, 55);
  doc.rect(x + padL + 28, y + 2, 3, 3, "F");
  doc.text("Saídas", x + padL + 33, y + 4.5);
}

export function exportRelatorioGerencial(d: RelatorioGerencialData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  const periodoLabel = formatPeriodoLabel(d.periodo.from, d.periodo.to);
  const missaoLabel = d.missaoNome ? ` · Missão: ${d.missaoNome}` : "";

  headerBar(doc, "Relatório Gerencial", `Empresa: ${d.empresaNome}${missaoLabel}`);

  // Título grande
  doc.setTextColor(...BRAND_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Visão consolidada", 12, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(periodoLabel + (d.missaoNome ? `  ·  Missão: ${d.missaoNome}` : ""), 12, 40);


  // KPIs (grid 4x2)
  const k = d.kpis;
  const cardW = (w - 12 * 2 - 6 * 3) / 4;
  const cardH = 20;
  let y0 = 46;
  const cells: Array<[string, string, string, [number, number, number]]> = [
    ["Total Contratado", formatCurrency(k.totalContratado), "Contratos e parcelas", BRAND_ORANGE],
    ["Total Recebido", formatCurrency(k.totalRecebido), "Pagamentos de clientes", [16, 185, 129]],
    ["Total em Aberto", formatCurrency(k.totalEmAberto), "Contratado − Recebido", [212, 175, 55]],
    ["Em Atraso", `${k.qtdAtrasados}`, `Vencidos · ${formatCurrency(k.totalVencido)}`, [220, 38, 38]],
    ["Despesas Operacionais", formatCurrency(k.totalOperacional), `Pagas: ${formatCurrency(k.despesasPagas)}`, [220, 38, 38]],
    ["Folha Mensal", formatCurrency(k.folhaMensal), "Funcionários ativos", [212, 175, 55]],
    ["Total Despesas", formatCurrency(k.totalDespesa), "Operacionais + Folha", BRAND_DARK],
    ["Lucro Líquido", formatCurrency(k.lucro), "Recebido − Despesas", k.lucro >= 0 ? BRAND_ORANGE : [220, 38, 38]],
  ];
  cells.forEach((c, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = 12 + col * (cardW + 6);
    const y = y0 + row * (cardH + 5);
    kpiBox(doc, x, y, cardW, cardH, c[0], c[1], c[2], c[3]);
  });

  // Indicador de inadimplência
  const yInad = y0 + 2 * (cardH + 5) + 3;
  doc.setDrawColor(225, 225, 225);
  doc.setFillColor(252, 252, 252);
  doc.roundedRect(12, yInad, w - 24, 14, 2, 2, "FD");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "normal");
  doc.text("Inadimplência", 16, yInad + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...BRAND_DARK);
  doc.text(`${k.inadimplencia}%`, 16, yInad + 12);

  // Gráfico de Fluxo
  const yChart = yInad + 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_DARK);
  doc.text("Fluxo de Caixa — últimos 6 meses", 12, yChart);
  barChart(doc, 12, yChart + 3, w - 24, 60, d.fluxoMensal);

  // Tabela de despesas por categoria
  if (d.despesasCategoria.length) {
    autoTable(doc, {
      head: [["Categoria", "Total"]],
      body: d.despesasCategoria.map((c) => [
        c.name.replace(/_/g, " "),
        formatCurrency(c.value),
      ]),
      startY: yChart + 70,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: BRAND_ORANGE, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      margin: { left: 12, right: 12 },
      didDrawPage: () => {},
    });
  }

  // Página 2: lucro por empresa
  if (d.empresasLucro && d.empresasLucro.length) {
    doc.addPage();
    headerBar(doc, "Relatório Gerencial", `Empresa: ${d.empresaNome}${missaoLabel}`);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...BRAND_DARK);
    doc.text("Lucro por empresa", 12, 34);
    autoTable(doc, {
      head: [["Empresa", "Receita", "Despesa", "Lucro Real.", "Lucro Proj."]],
      body: d.empresasLucro.map((e) => [
        e.nome,
        formatCurrency(e.receita_realizada),
        formatCurrency(e.despesa_realizada),
        formatCurrency(e.lucro_realizado),
        formatCurrency(e.lucro_projetado),
      ]),
      startY: 40,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: BRAND_ORANGE, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      margin: { left: 12, right: 12 },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
      },
    });
  }

  footer(doc);
  doc.save(`relatorio_gerencial_${sanitize(d.empresaNome)}_${timestamp()}.pdf`);
}
