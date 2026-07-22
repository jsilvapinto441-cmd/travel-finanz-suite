import { Link, useLocation, useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard, Building2, Target, FileText, ArrowDownLeft, ArrowUpRight,
  Users, Truck, Package, TrendingUp, ShieldCheck, LogOut, Settings, Menu, Landmark, X, Zap, UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { useIdleTimeout } from "@/lib/idle-timeout";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AssistantFAB } from "@/components/ai-assistant";
import { useBrand } from "@/lib/brand";



const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/bancos", label: "Bancos", icon: Landmark },
  { to: "/empresas", label: "Empresas", icon: Building2 },
  { to: "/missoes", label: "Missões", icon: Target },
  { to: "/contratos", label: "Contratos", icon: FileText },
  { to: "/recebiveis", label: "Recebíveis", icon: ArrowDownLeft },
  { to: "/despesas", label: "Despesas", icon: ArrowUpRight },
  { to: "/funcionarios", label: "Funcionários", icon: Users },
  { to: "/prestadores-mei", label: "Prestadores de Serviços (MEI)", icon: Users },
  { to: "/consolidadoras", label: "Consolidadoras", icon: Truck },
  { to: "/fornecedores", label: "Fornecedores", icon: Package },
  { to: "/lucro", label: "Lucros", icon: TrendingUp },
  { to: "/perfil", label: "Login", icon: UserCircle },
  { to: "/admin", label: "Administração", icon: ShieldCheck, adminOnly: true },
] as const;

// Barra inferior mobile — 4 módulos mais usados + botão Menu
const bottomNav = [
  { to: "/", label: "Início", icon: LayoutDashboard },
  { to: "/recebiveis", label: "Receber", icon: ArrowDownLeft },
  { to: "/despesas", label: "Pagar", icon: ArrowUpRight },
  { to: "/contratos", label: "Contratos", icon: FileText },
] as const;


export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();
  const roleLabel = isAdmin ? "Administrador" : "Usuário";

  const handleIdle = useCallback(async () => {
    toast.info("Sessão encerrada por inatividade");
    await signOut();
    navigate({ to: "/login" });
  }, [signOut, navigate]);
  useIdleTimeout(30, handleIdle);

  // Fecha o drawer ao trocar de rota
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const navItems = nav.filter((i) => !("adminOnly" in i && i.adminOnly) || isAdmin);

  const currentLabel = navItems.find((i) =>
    i.to === "/" ? location.pathname === "/" : location.pathname.startsWith(i.to),
  )?.label ?? "Rotas";

  const { name: empresaNome, logo: empresaLogo } = useBrand();
  const showEmpresa = empresaNome && empresaNome !== "Rotas";

  const CompanyBadge = ({ compact = false }: { compact?: boolean }) => (
    <div className={cn(
      "flex items-center gap-2.5 rounded-full border border-border/60 bg-card/60 py-1",
      compact ? "pl-1 pr-1" : "pl-1 pr-3 max-w-[70vw] md:max-w-sm",
    )}>
      {empresaLogo ? (
        <img src={empresaLogo} alt="" className={cn(
          "rounded-full object-cover shrink-0 ring-1 ring-border/40",
          compact ? "size-8" : "size-10 md:size-11",
        )} />
      ) : (
        <div className={cn(
          "rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0",
          compact ? "size-8" : "size-10 md:size-11",
        )}>
          <Building2 className={cn(compact ? "size-4" : "size-5", "text-primary")} />
        </div>
      )}
      {!compact && (
        <span className="text-sm font-semibold truncate">{empresaNome}</span>
      )}
    </div>
  );


  const SidebarContent = (
    <>
      <div className="px-6 py-7 border-b border-sidebar-border flex items-center justify-center">
        <img src={rotasLogo.url} alt="ROTAS" className="h-10 w-auto object-contain" />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-3.5 md:py-2.5 rounded-md text-base md:text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-5 md:size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="size-9 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-semibold shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{user?.email}</div>
            <div className="text-[11px] uppercase tracking-wider text-sidebar-foreground/60">
              {roleLabel}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-10 md:h-8 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => navigate({ to: "/configuracoes" })}
          >
            <Settings className="size-4 md:size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-10 md:h-8 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
          >
            <LogOut className="size-4 md:size-3.5 mr-1" /> Sair
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar desktop - fixa, não acompanha o scroll do conteúdo */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-screen sticky top-0 shrink-0">
        {SidebarContent}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        {/* Top bar desktop — mostra empresa vinculada ao usuário logado */}
        {showEmpresa && (
          <header className="hidden md:flex sticky top-0 z-30 items-center justify-end gap-3 px-6 h-14 border-b border-border bg-background/80 backdrop-blur shrink-0">
            <CompanyBadge />
          </header>
        )}
        {/* Top bar mobile — respeita safe-area do notch */}

        <header className="md:hidden sticky top-0 z-30 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 h-14 pt-[env(safe-area-inset-top)] border-b border-sidebar-border bg-sidebar text-sidebar-foreground shrink-0"
          style={{ height: "calc(3.5rem + env(safe-area-inset-top))" }}
        >
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menu" className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent shrink-0">
                <Menu className="size-6" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[85vw] max-w-80 p-0 flex flex-col bg-sidebar text-sidebar-foreground border-sidebar-border pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
            >
              <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
              <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border md:hidden">
                <span className="text-sm font-semibold">Menu</span>
                <SheetClose asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent">
                    <X className="size-5" />
                  </Button>
                </SheetClose>
              </div>
              {SidebarContent}
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex flex-col justify-center leading-tight">
            <span className="truncate text-[15px] font-semibold">{currentLabel}</span>
            {showEmpresa && (
              <span className="truncate text-[11px] text-sidebar-foreground/60">{empresaNome}</span>
            )}
          </div>

          {showEmpresa ? (
            <CompanyBadge compact />
          ) : (
            <div className="size-9 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-semibold shrink-0">
              {initials}
            </div>
          )}

        </header>


        <main className="flex-1 min-w-0 overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          <Outlet />
        </main>

        {/* Bottom navigation — apenas mobile, respeita safe-area do iPhone */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-5 border-t border-sidebar-border bg-sidebar/95 backdrop-blur-lg text-sidebar-foreground pb-[env(safe-area-inset-bottom)]"
          aria-label="Navegação principal"
        >
          {bottomNav.map((item) => {
            const active =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 h-16 text-[10px] font-medium transition-colors active:bg-sidebar-accent/60",
                  active
                    ? "text-primary"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "drop-shadow-[0_0_6px_var(--color-primary)]")} />
                <span className="truncate max-w-full px-1">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 h-16 text-[10px] font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground active:bg-sidebar-accent/60 transition-colors"
            aria-label="Abrir menu completo"
          >
            <Menu className="size-5" />
            <span>Menu</span>
          </button>
        </nav>
      </div>

      <AssistantFAB />
    </div>
  );
}

