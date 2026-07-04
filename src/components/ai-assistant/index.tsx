import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AssistantChat } from "@/components/ai-assistant/chat";
import { cn } from "@/lib/utils";
import logo from "@/assets/produz-logo-white.png";

export function AssistantFAB() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir Assistente Financeiro IA"
        className={cn(
          "fixed bottom-5 right-5 z-40 group",
          "size-14 rounded-full flex items-center justify-center",
          "bg-gradient-to-br from-primary via-primary to-orange-600",
          "text-primary-foreground shadow-[0_10px_30px_-5px_rgba(249,115,22,0.55)]",
          "ring-1 ring-primary/40",
          "transition-all duration-300 ease-out",
          "hover:scale-110 hover:shadow-[0_15px_45px_-5px_rgba(249,115,22,0.75)]",
          "animate-in fade-in zoom-in duration-500",
        )}
      >
        <span className="absolute inset-0 rounded-full bg-primary/30 blur-xl opacity-0 group-hover:opacity-70 transition-opacity" />
        <img
          src={logo}
          alt=""
          className="relative h-7 w-auto drop-shadow group-hover:scale-105 transition-transform"
        />
        <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-primary-foreground text-primary shadow-sm">
          <Sparkles className="size-2.5" />
        </span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="p-0 w-full sm:max-w-[440px] flex flex-col border-l border-border"
        >
          <SheetTitle className="sr-only">Assistente Financeiro IA</SheetTitle>
          <AssistantChat onClose={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
