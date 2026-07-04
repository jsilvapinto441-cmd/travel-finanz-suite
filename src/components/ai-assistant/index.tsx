import { useState } from "react";
import { Zap } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AssistantChat } from "@/components/ai-assistant/chat";
import { cn } from "@/lib/utils";

export function AssistantFAB() {
  const [open, setOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir Assistente Financeiro IA"
        className={cn(
          "fixed bottom-5 right-5 z-40",
          "group flex items-center justify-center",
          "size-14 rounded-full",
          "bg-black/20 backdrop-blur-sm",
          "border border-white/5",
          "transition-all duration-300 ease-out",
          "hover:scale-[1.08]",
          isProcessing && "animate-flash-pulse",
        )}
      >
        <span className="absolute inset-0 rounded-full bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <span className="absolute inset-0 rounded-full bg-primary/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <Zap
          className={cn(
            "relative size-7 text-primary transition-all duration-300",
            "drop-shadow-[0_0_10px_rgba(249,115,22,0.45)]",
            "group-hover:drop-shadow-[0_0_18px_rgba(249,115,22,0.85)]",
            isProcessing && "drop-shadow-[0_0_14px_rgba(249,115,22,0.65)]",
          )}
          strokeWidth={2.5}
        />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="p-0 w-full sm:max-w-[440px] flex flex-col border-l border-border"
        >
          <SheetTitle className="sr-only">Assistente Financeiro IA</SheetTitle>
          <AssistantChat
            onClose={() => setOpen(false)}
            onProcessingChange={setIsProcessing}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

