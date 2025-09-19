"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Glimpse,
  GlimpseContent,
  GlimpseDescription,
  GlimpseImage,
  GlimpseTitle,
  GlimpseTrigger,
} from "./index";
import { glimpse } from "./server";
import { cn } from "@/lib/utils";

type GlimpseData = {
  title: string | null;
  description: string | null;
  image: string | null;
};

type ClientGlimpseLinkProps = React.ComponentPropsWithoutRef<"a"> & {
  href?: string;
  previewClassName?: string;
};

type Status = "idle" | "loading" | "loaded" | "error";

export function ClientGlimpseLink({
  href,
  children,
  className,
  previewClassName,
  ...anchorProps
}: ClientGlimpseLinkProps) {
  if (!href) {
    return (
      <a className={className} {...anchorProps}>
        {children}
      </a>
    );
  }

  const [data, setData] = useState<GlimpseData | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  const loadPreview = useCallback(async () => {
    if (!href || status !== "idle") {
      return;
    }
    try {
      setStatus("loading");
      const response = await glimpse(href);
      setData(response);
      setStatus("loaded");
    } catch (error) {
      console.error("Failed to load link preview", error);
      setStatus("error");
    }
  }, [href, status]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        void loadPreview();
      }
    },
    [loadPreview]
  );

  const content = useMemo(() => {
    if (status === "loading") {
      return (
        <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
          Loading preview...
        </div>
      );
    }

    if (status === "error") {
      return (
        <div className="text-sm text-muted-foreground">
          Preview unavailable.
        </div>
      );
    }

    if (!data || (!data.title && !data.description)) {
      return (
        <div className="text-sm text-muted-foreground">
          No preview information.
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        {data.image ? <GlimpseImage src={data.image} alt={data.title ?? ""} /> : null}
        {data.title ? <GlimpseTitle>{data.title}</GlimpseTitle> : null}
        {data.description ? (
          <GlimpseDescription>{data.description}</GlimpseDescription>
        ) : null}
      </div>
    );
  }, [data, status]);

  return (
    <Glimpse openDelay={0} closeDelay={0} onOpenChange={handleOpenChange}>
      <GlimpseTrigger asChild>
        <a
          className={cn("text-primary underline", className)}
          href={href}
          rel="noreferrer"
          target="_blank"
          {...anchorProps}
        >
          {children}
        </a>
      </GlimpseTrigger>
      <GlimpseContent className={cn("w-80", previewClassName)}>
        {content}
      </GlimpseContent>
    </Glimpse>
  );
}

export default ClientGlimpseLink;
