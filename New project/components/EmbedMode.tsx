"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function EmbedMode() {
  const searchParams = useSearchParams();
  const isEmbed = searchParams.get("embed") === "true";

  useEffect(() => {
    document.body.dataset.embed = isEmbed ? "true" : "false";

    if (!isEmbed) {
      document.documentElement.style.height = "";
      document.body.style.height = "";
      document.body.style.overflow = "";
      return;
    }

    document.documentElement.style.height = "100%";
    document.body.style.height = "100%";
    document.body.style.overflow = "hidden";

    return () => {
      document.body.dataset.embed = "false";
      document.documentElement.style.height = "";
      document.body.style.height = "";
      document.body.style.overflow = "";
    };
  }, [isEmbed]);

  return null;
}
