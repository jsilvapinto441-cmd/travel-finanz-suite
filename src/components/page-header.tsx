import { type ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4 mb-5 sm:mb-8">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight truncate">{title}</h1>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2 -mx-1 px-1 overflow-x-auto sm:overflow-visible sm:mx-0 sm:px-0">{actions}</div>}
    </div>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="p-3 sm:p-6 lg:p-10 max-w-[1600px] mx-auto">{children}</div>;
}

