"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowUp, Cloud, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const MODELS = [
  {
    value: "gemini-3.1-pro",
    name: "Gemini 3.1 Pro",
    description: "Most advanced — used for sub-agents",
    max: true,
  },
  {
    value: "gemini-3-flash",
    name: "Gemini 3 Flash",
    description: "Fast orchestrator and router",
  },
  {
    value: "gemini-3.1-flash-image",
    name: "Gemini 3.1 Flash Image",
    description: "Image generation",
  },
];

type Model = (typeof MODELS)[number];

function MaxBadge() {
  return (
    <div className="flex h-[14px] items-center gap-1.5 rounded border border-border px-1 py-0">
      <span
        className="text-[9px] font-bold uppercase"
        style={{
          background:
            "linear-gradient(to right, rgb(129, 161, 193), rgb(125, 124, 155))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        MAX
      </span>
    </div>
  );
}

export function PromptBar({
  onSubmit,
  isLoading,
  onStop,
}: {
  onSubmit: (text: string) => void;
  isLoading: boolean;
  onStop: () => void;
}) {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<Model>(MODELS[0]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    if (!input.trim() || isLoading) return;
    onSubmit(input.trim());
    setInput("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  const handleModelChange = (value: string) => {
    const model = MODELS.find((m) => m.value === value);
    if (model) setSelectedModel(model);
  };

  return (
    <div className="p-3">
      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl">
        <div className="flex cursor-text flex-col rounded-2xl border border-border bg-card shadow-lg">
          <div className="relative max-h-[180px] flex-1 overflow-y-auto">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Follow up..."
              rows={1}
              className="min-h-9 w-full resize-none whitespace-pre-wrap break-words border-0 bg-transparent! px-3 py-2 text-sm text-foreground shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          <div className="flex min-h-9 items-center gap-2 p-1.5 pb-1">
            <div className="flex aspect-1 items-center gap-1 rounded-full bg-muted p-1 text-xs">
              <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
            </div>

            <div
              className="relative flex items-center"
              title="Model is selected automatically by the router"
            >
              <Select
                value={selectedModel.value}
                onValueChange={handleModelChange}
              >
                <SelectTrigger className="w-fit border-none bg-transparent! p-0 text-xs text-muted-foreground shadow-none hover:text-foreground focus:ring-0">
                  <SelectValue>
                    {selectedModel.max ? (
                      <div className="flex items-center gap-1">
                        <span>{selectedModel.name}</span>
                        <MaxBadge />
                      </div>
                    ) : (
                      <span>{selectedModel.name}</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.max ? (
                        <div className="flex items-center gap-1">
                          <span>{model.name}</span>
                          <MaxBadge />
                        </div>
                      ) : (
                        <span>{model.name}</span>
                      )}
                      <span className="block text-xs text-muted-foreground">
                        {model.description}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground transition-colors duration-100 ease-out hover:text-foreground"
                title="Attach images"
                aria-label="Attach images"
              >
                <ImagePlus className="h-4 w-4" />
              </Button>

              {isLoading ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onStop}
                  className="h-7 rounded-full text-xs"
                >
                  <Loader2 className="size-3 animate-spin" />
                  Stop
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-sm"
                  disabled={!input.trim()}
                  className={cn(
                    "cursor-pointer rounded-full bg-primary transition-colors duration-100 ease-out",
                    input.trim() && "bg-primary hover:bg-primary/90!",
                  )}
                  aria-label="Send message"
                >
                  <ArrowUp className="h-3.5 w-3.5 text-primary-foreground" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
