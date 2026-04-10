"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUp, Cloud, ImagePlus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PromptInput,
  PromptInputHeader,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionAddAttachments,
  PromptInputActionAddScreenshot,
  usePromptInputAttachments,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import {
  Attachments,
  Attachment,
  AttachmentPreview,
  AttachmentInfo,
  AttachmentRemove,
} from "@/components/ai-elements/attachments";

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
    <div className="flex h-3.5 items-center gap-1.5 rounded border border-border px-1 py-0">
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
  onSubmit: (message: PromptInputMessage) => void;
  isLoading: boolean;
}

export function NexusPrompt({ onSubmit, isLoading }: NexusPromptProps) {
  const [selectedModel, setSelectedModel] = useState<Model>(MODELS[0]);

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
      <PromptInput
        accept="image/*"
        multiple
        onSubmit={(message) => {
          if (!message.text?.trim() || isLoading) return;
          onSubmit(message);
        }}
        className={[
          "w-full",
          "*:data-[slot=input-group]:min-h-30",
          "*:data-[slot=input-group]:rounded-2xl",
          "*:data-[slot=input-group]:border",
          "*:data-[slot=input-group]:border-border",
          "*:data-[slot=input-group]:bg-card",
          "*:data-[slot=input-group]:shadow-lg",
          "*:data-[slot=input-group]:has-[[data-slot=input-group-control]:focus-visible]:ring-0",
          "*:data-[slot=input-group]:has-[[data-slot=input-group-control]:focus-visible]:border-border",
        ].join(" ")}
      >
          <NexusAttachmentsHeader />

          <PromptInputTextarea
            placeholder="Ask anything"
            className="field-sizing-content max-h-64.5 min-h-[48.4px] border-0 bg-transparent! p-3 text-[16px] focus-visible:ring-0 focus-visible:ring-offset-0"
          />

          <PromptInputFooter className="min-h-10 items-center gap-2 p-2 pb-1">
            <PromptInputTools>
              <div className="flex aspect-1 items-center gap-1 rounded-full bg-muted p-1.5 text-xs">
                <Cloud className="h-4 w-4 text-muted-foreground" />
              </div>

              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Attach files"
                >
                  <ImagePlus className="h-5 w-5" />
                </PromptInputActionMenuTrigger>
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                  <PromptInputActionAddScreenshot />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>

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
            </PromptInputTools>

            <PromptInputSubmit
              status={isLoading ? "submitted" : undefined}
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90! disabled:opacity-50"
              aria-label="Send message"
            >
              {isLoading ? undefined : <ArrowUp className="h-4 w-4" />}
            </PromptInputSubmit>
          </PromptInputFooter>
      </PromptInput>
    </motion.div>
  );
}

function NexusAttachmentsHeader() {
  const { files, remove } = usePromptInputAttachments();
  if (files.length === 0) return null;
  return (
    <PromptInputHeader className="px-2 pt-2">
      <Attachments variant="inline">
        {files.map((file) => (
          <Attachment key={file.id} data={file} onRemove={() => remove(file.id)}>
            <AttachmentPreview />
            <AttachmentInfo />
            <AttachmentRemove />
          </Attachment>
        ))}
      </Attachments>
    </PromptInputHeader>
  );
}
