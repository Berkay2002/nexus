"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
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

interface NexusPromptProps {
  onSubmit: (text: string) => void;
  isLoading: boolean;
}

export function NexusPrompt({ onSubmit, isLoading }: NexusPromptProps) {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<Model>(MODELS[0]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

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
    <motion.div
      className="w-full max-w-2xl"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
    >
      <form onSubmit={handleSubmit}>
        <div className="flex min-h-[120px] cursor-text flex-col rounded-2xl border border-border bg-card shadow-lg">
          <div className="relative max-h-[258px] flex-1 overflow-y-auto">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.metaKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Ask anything"
              className="min-h-[48.4px] w-full resize-none whitespace-pre-wrap break-words border-0 bg-transparent! p-3 text-[16px] text-foreground shadow-none outline-none transition-[padding] duration-200 ease-in-out focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          <div className="flex min-h-[40px] items-center gap-2 p-2 pb-1">
            <div className="flex aspect-1 items-center gap-1 rounded-full bg-muted p-1.5 text-xs">
              <Cloud className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="relative flex items-center">
              <Select
                value={selectedModel.value}
                onValueChange={handleModelChange}
              >
                <SelectTrigger className="w-fit border-none bg-transparent! p-0 text-sm text-muted-foreground shadow-none hover:text-foreground focus:ring-0">
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

            <div className="ml-auto flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground transition-colors duration-100 ease-out hover:text-foreground"
                title="Attach images"
                aria-label="Attach images"
              >
                <ImagePlus className="h-5 w-5" />
              </Button>

              <Button
                type="submit"
                variant="ghost"
                size="icon-sm"
                disabled={isLoading || !input.trim()}
                className={cn(
                  "cursor-pointer rounded-full bg-primary transition-colors duration-100 ease-out",
                  input.trim() && "bg-primary hover:bg-primary/90!",
                )}
                aria-label="Send message"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
                ) : (
                  <ArrowUp className="h-4 w-4 text-primary-foreground" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </motion.div>
  );
}
