"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { ArrowUp, File as FileIcon, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Local attachment shape: images carry their Data URL, non-images only carry
// the metadata. FileUIPart (from `ai`) requires `url`, so we carry the optional
// form in state and fill an empty string at the submit boundary — consumers
// (PromptBar thumbnails, buildHumanContent) already guard on truthy+image.
type AttachedFile = {
  type: "file";
  filename: string;
  mediaType: string;
  url?: string;
};

export function PromptBar({
  onSubmit,
  isLoading,
  onStop,
  placeholder = "Follow up...",
  size = "sm",
}: {
  onSubmit: (message: string | PromptInputMessage) => void;
  isLoading: boolean;
  onStop?: () => void;
  placeholder?: string;
  size?: "sm" | "lg";
}) {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [isConvertingFiles, setIsConvertingFiles] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toDataUrl = (file: File): Promise<string | null> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });

  const addFiles = async (incomingFiles: FileList | File[]) => {
    const selectedFiles = Array.from(incomingFiles);
    if (selectedFiles.length === 0) {
      return;
    }

    setIsConvertingFiles(true);
    try {
      // Only image files need a Data URL (they're sent as image_url parts to
      // the model). Non-images are only referenced by filename/mediaType in
      // buildHumanContent — base64-ing them would waste memory and stall the UI
      // on large attachments.
      const converted = await Promise.all(
        selectedFiles.map(async (file) => {
          const isImage = file.type.startsWith("image/");
          if (isImage) {
            const dataUrl = await toDataUrl(file);
            if (!dataUrl) return null;
            return {
              type: "file" as const,
              filename: file.name,
              mediaType: file.type,
              url: dataUrl,
            };
          }
          return {
            type: "file" as const,
            filename: file.name,
            mediaType: file.type,
          };
        }),
      );

      setFiles((previous) => [
        ...previous,
        ...converted.filter((file): file is AttachedFile => file !== null),
      ]);
    } finally {
      setIsConvertingFiles(false);
    }
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      await addFiles(event.target.files);
    }
    event.target.value = "";
  };

  const handleDragOver = (event: DragEvent<HTMLFormElement>) => {
    if (event.dataTransfer?.types?.includes("Files")) {
      event.preventDefault();
      if (!isDraggingFiles) {
        setIsDraggingFiles(true);
      }
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLFormElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDraggingFiles(false);
    }
  };

  const handleDrop = async (event: DragEvent<HTMLFormElement>) => {
    if (event.dataTransfer?.types?.includes("Files")) {
      event.preventDefault();
    }
    setIsDraggingFiles(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      await addFiles(event.dataTransfer.files);
    }
  };

  const removeFileAtIndex = (indexToRemove: number) => {
    setFiles((previous) =>
      previous.filter((_, index) => index !== indexToRemove),
    );
  };

  const submit = () => {
    if ((!input.trim() && files.length === 0) || isLoading || isConvertingFiles) return;
    const outgoing: PromptInputMessage["files"] = files.map((f) => ({
      type: "file",
      filename: f.filename,
      mediaType: f.mediaType,
      // FileUIPart.url is required; non-image attachments get an empty
      // placeholder (buildHumanContent ignores url for non-image parts).
      url: f.url ?? "",
    }));
    onSubmit({ text: input.trim(), files: outgoing });
    setInput("");
    setFiles([]);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  return (
    <div className="p-3">
      <form
        onSubmit={handleSubmit}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="mx-auto w-full max-w-3xl"
      >
        <div
          className={cn(
            "flex cursor-text flex-col rounded-2xl border border-border bg-card shadow-lg transition-colors",
            size === "lg" && "min-h-32",
            isDraggingFiles && "border-primary/60 bg-primary/5",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          {files.length > 0 ? (
            <div className="px-2 pt-2">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {files.map((file, index) => (
                  <div
                    key={`${file.filename ?? "image"}-${index}`}
                    className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border/80 bg-muted"
                  >
                    {file.url && file.mediaType?.startsWith("image/") ? (
                      <img
                        src={file.url}
                        alt={file.filename ?? `Attached image ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-[10px] text-muted-foreground">
                        <FileIcon className="h-3.5 w-3.5" />
                        <span className="max-w-full truncate text-center leading-tight">
                          {file.filename ?? "File"}
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => removeFileAtIndex(index)}
                      className="absolute right-1 top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black/90"
                      aria-label={`Remove ${file.filename ?? `image ${index + 1}`}`}
                      title={file.mediaType?.startsWith("image/") ? "Remove image" : "Remove attachment"}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div
            className={cn(
              "relative flex-1 overflow-y-auto",
              size === "lg" ? "max-h-64" : "max-h-[180px]",
            )}
          >
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
              placeholder={placeholder}
              rows={1}
              className={cn(
                "w-full resize-none whitespace-pre-wrap break-words border-0 bg-transparent! shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                size === "lg"
                  ? "min-h-20 px-4 py-3 text-base"
                  : "min-h-9 px-3 py-2 text-sm",
                "text-foreground",
              )}
            />
          </div>

          <div className="flex min-h-9 items-center gap-2 p-1.5 pb-1">
            <div className="flex aspect-1 items-center gap-1 rounded-full bg-muted p-1 text-xs">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors duration-100 ease-out hover:text-foreground"
                title="Attach files"
                aria-label="Attach files"
              >
                {isConvertingFiles ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
              </button>
              {files.length > 0 ? (
                <span className="pr-1 text-[11px] text-muted-foreground">
                  {files.length}
                </span>
              ) : null}
            </div>

            <div className="ml-auto flex items-center gap-2">
              {isLoading && onStop ? (
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
                  disabled={
                    (!input.trim() && files.length === 0) ||
                    isConvertingFiles ||
                    isLoading
                  }
                  className={cn(
                    "h-9 w-9 cursor-pointer rounded-full bg-primary transition-colors duration-100 ease-out",
                    (input.trim() || files.length > 0) &&
                      "bg-primary hover:bg-primary/90!",
                  )}
                  aria-label="Send message"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
                  ) : (
                    <ArrowUp className="h-4 w-4 text-primary-foreground" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
