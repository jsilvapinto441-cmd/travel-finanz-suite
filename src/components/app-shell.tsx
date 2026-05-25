import { Link, useLocation, useNavigate, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard, Building2, Target, FileText, ArrowDownLeft, ArrowUpRight,
  Users, Truck, TrendingUp, ShieldCheck, LogOut, Settings, Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useIdleTimeout } from "@/lib/idle-timeout";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import logo from "@/assets/produz-logo-white.png";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/empresas", label: "Empresas", icon: Building2 },
  { to: "/missoes", label: "Missões", icon: Target },
  { to: "/contratos", label: "Contratos", icon: FileText },
  { to: "/recebiveis", label: "Recebíveis", icon: ArrowDownLeft },
  { to: "/despesas", label: "Despesas", icon: ArrowUpRight },
  { to: "/funcionarios", label: "Funcionários", icon: Users },
  { to: "/fornecedores", label: "Fornecedores", icon: Truck },
  { to: "/lucro", label: "Lucros", icon: TrendingUp },
  { to: "/admin", label: "Administração", icon: ShieldCheck, adminOnly: true },
] as const;

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, isAdmin, roles } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();
  const roleLabel = isAdmin ? "Administrador" : roles[0] ?? "—";

  const handleIdle = useCallback(async () => {
    toast.info("Sessão encerrada por inatividade");
    await signOut();
    navigate({ to: "/login" });
  }, [signOut, navigate]);
  useIdleTimeout(30, handleIdle);

  // Fecha o drawer ao trocar de rota
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const navItems = nav.filter((i) => !("adminOnly" in i && i.adminOnly) || isAdmin);

  const SidebarContent = (
    <>
      <div className="px-6 py-7 border-b border-sidebar-border flex items-center justify-center">
        <img src={logo} alt="PRODUZ" className="h-9 w-auto" />
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
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4" />
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
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-8 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={() => navigate({ to: "/configuracoes" })}
            >
              <Settings className="size-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
          >
            <LogOut className="size-3.5 mr-1" /> Sair
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        {SidebarContent}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar mobile */}
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 h-14 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 p-0 flex flex-col bg-sidebar text-sidebar-foreground border-sidebar-border"
            >
              <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
              {SidebarContent}
            </SheetContent>
          </Sheet>
          <img src={logo} alt="PRODUZ" className="h-7 w-auto" />
          <div className="size-9 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-semibold">
            {initials}
          </div>
        </header>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
