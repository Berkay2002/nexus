"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Settings01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { ModelSettingsSheet } from "./model-settings-sheet";

interface SettingsButtonProps {
  className?: string;
}

export function SettingsButton({ className }: SettingsButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label="Model settings"
        className={className}
      >
        <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
      </Button>
      <ModelSettingsSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
