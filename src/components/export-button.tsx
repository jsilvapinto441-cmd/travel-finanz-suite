import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import {
  exportToExcel,
  exportToPDF,
  type ExportColumn,
} from "@/lib/export";

export function ExportButton<T>({
  title,
  subtitle,
  summary,
  filters,
  filename,
  columns,
  rows,
  disabled,
}: {
  title: string;
  subtitle?: string;
  summary?: { label: string; value: string }[];
  filters?: { label: string; value: string }[];
  filename?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  disabled?: boolean;
}) {
  const empty = !rows || rows.length === 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || empty}>
          <Download className="size-4 mr-2" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => {
            void exportToPDF({ title, subtitle, summary, filters, columns, rows, filename });
          }}
        >
          <FileText className="size-4 mr-2" />
          PDF
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            exportToExcel({
              sheetName: title,
              columns,
              rows,
              filename: filename ?? title,
              subtitle,
              summary,
              filters,
            })
          }
        >
          <FileSpreadsheet className="size-4 mr-2" />
          Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
