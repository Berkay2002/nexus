import { cn } from "@/lib/utils";
import type { ImgHTMLAttributes } from "react";

export type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string;
  base64?: string;
  mediaType?: string;
  uint8Array?: Uint8Array;
};

export const Image = ({
  src,
  base64,
  uint8Array: _uint8Array,
  mediaType,
  ...props
}: ImageProps) => {
  const resolvedSrc =
    src ??
    (base64 && mediaType
      ? `data:${mediaType};base64,${base64}`
      : undefined);

  if (!resolvedSrc) {
    return null;
  }

  return (
    <img
      {...props}
      alt={props.alt ?? ""}
      className={cn(
        "h-auto max-w-full overflow-hidden rounded-md",
        props.className
      )}
      src={resolvedSrc}
    />
  );
};
