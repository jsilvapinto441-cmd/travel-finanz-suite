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
  filename,
  columns,
  rows,
  disabled,
}: {
  title: string;
  subtitle?: string;
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
          onClick={() =>
            exportToPDF({ title, subtitle, columns, rows, filename })
          }
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
