"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Share, X } from "lucide-react";

/**
 * The event Chrome/Edge/Android fire when the app is installable.
 * It isn't in the built-in TS DOM types yet, so we describe it here.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PromptWindow = Window & { __dkInstallPrompt?: BeforeInstallPromptEvent | null };

/**
 * "Install app" button. It is ADDITIVE — it renders its own button and an
 * optional help popup, and touches nothing else on the page.
 *
 * The real one-tap install prompt (`beforeinstallprompt`) fires very early, so
 * it's captured in an inline script in layout.tsx and stashed on
 * `window.__dkInstallPrompt`; this component reads it. That's what makes the
 * button do a genuine one-tap install on Android / Chrome / Edge / desktop.
 * The help popup is only a fallback for browsers that don't support it (iOS,
 * Firefox, or when the app is already installed).
 */
export function InstallButton({ className = "" }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [help, setHelp] = useState<null | "ios" | "generic">(null);

  useEffect(() => {
    // If it's already opened as an installed app, there's nothing to offer.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    setIsIos(/iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()));

    // Pick up a prompt the inline script may have already captured before we mounted.
    const stashed = (window as PromptWindow).__dkInstallPrompt;
    if (stashed) setDeferred(stashed);

    const onReady = () => {
      const p = (window as PromptWindow).__dkInstallPrompt;
      if (p) setDeferred(p);
    };
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      setHelp(null);
    };

    window.addEventListener("dk-install-ready", onReady);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("dk-install-done", onInstalled);
    return () => {
      window.removeEventListener("dk-install-ready", onReady);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("dk-install-done", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function handleClick() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      // A prompt can only be used once.
      setDeferred(null);
      (window as PromptWindow).__dkInstallPrompt = null;
      return;
    }
    setHelp(isIos ? "ios" : "generic");
  }

  const popup = (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-coffee/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={() => setHelp(null)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-cream p-6 shadow-warm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="font-display text-xl text-coffee">Install Das Kitchen</h2>
          <button
            onClick={() => setHelp(null)}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-brown hover:bg-brown/5"
          >
            <X size={18} />
          </button>
        </div>

        {help === "ios" ? (
          <>
            <p className="mt-2 text-sm text-brown/80">
              On iPhone or iPad, add Das Kitchen to your Home Screen in two taps:
            </p>
            <ol className="mt-4 space-y-3 text-sm text-brown">
              <li className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold-dark">
                  1
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  Tap the Share icon
                  <Share size={16} className="inline text-gold-dark" />
                  at the bottom of Safari.
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold-dark">
                  2
                </span>
                <span>
                  Choose <strong>&ldquo;Add to Home Screen&rdquo;</strong>, then tap <strong>Add</strong>.
                </span>
              </li>
            </ol>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-brown/80">To install the app on this device:</p>
            <ol className="mt-4 space-y-3 text-sm text-brown">
              <li className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold-dark">
                  1
                </span>
                <span>
                  Open your browser menu (the <strong>⋮</strong> or <strong>⋯</strong> icon).
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold-dark">
                  2
                </span>
                <span>
                  Choose <strong>&ldquo;Install app&rdquo;</strong> or <strong>&ldquo;Add to Home screen&rdquo;</strong>.
                </span>
              </li>
            </ol>
            <p className="mt-3 text-xs text-brown/60">
              On desktop Chrome or Edge you can also click the install icon in the address bar.
            </p>
          </>
        )}

        <button
          onClick={() => setHelp(null)}
          className="mt-6 w-full rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-white hover:bg-gold-dark"
        >
          Got it
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={handleClick}
        aria-label="Install the Das Kitchen app"
        className={
          className ||
          "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-xs font-semibold text-gold-dark transition-colors hover:bg-gold/20"
        }
      >
        <Download size={15} />
        <span className="hidden sm:inline">Install app</span>
      </button>

      {/* `help` only becomes non-null after a client-side tap, so document.body
          is always available here — safe with server rendering. */}
      {help && createPortal(popup, document.body)}
    </>
  );
}
