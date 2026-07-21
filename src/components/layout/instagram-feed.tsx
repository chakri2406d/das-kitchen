"use client";

import { createElement, useEffect, useState } from "react";

/**
 * Live Instagram gallery via Behold.so.
 *
 * Behold ships a web component (<behold-widget>) that renders the latest posts
 * — including reels/videos — and refreshes itself. We inject its script once,
 * client-side only, so it never touches the server render.
 *
 * If no feed ID is configured, we render `fallback` instead (the static grid),
 * so the homepage always looks finished even before the owner has connected
 * their Instagram.
 */
export function InstagramFeed({
  feedId,
  fallback,
}: {
  feedId: string;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!feedId) return;
    const SRC = "https://w.behold.so/widget.js";
    if (document.querySelector(`script[src="${SRC}"]`)) return;

    const s = document.createElement("script");
    s.type = "module";
    s.src = SRC;
    s.onerror = () => setFailed(true); // offline / blocked → show the grid
    document.body.appendChild(s);
  }, [feedId]);

  if (!feedId || failed) return <>{fallback}</>;

  // createElement avoids having to teach TypeScript's JSX about the custom tag.
  return (
    <div className="mt-8">
      {createElement("behold-widget", { "feed-id": feedId })}
    </div>
  );
}
