import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BookmarkPlus,
  Check,
  Copy,
  LockKeyhole,
  Pipette,
} from "lucide-react";
import { browser } from "wxt/browser";
import {
  PENDING_COLOR_KEY,
  START_COLOR_PICKER,
  colorFormats,
  isPendingColor,
  type PendingColor,
} from "../../lib/color-picker";

const isConnected = false;

export default function App() {
  const [pendingColor, setPendingColor] = useState<PendingColor | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [pickerError, setPickerError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void browser.storage.local.get(PENDING_COLOR_KEY).then((stored) => {
      const color = stored[PENDING_COLOR_KEY];
      if (isPendingColor(color)) setPendingColor(color);
    });
  }, []);

  const pickColor = async () => {
    setIsPicking(true);
    setPickerError("");
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id == null) {
        throw new Error("Open a web page to pick a color.");
      }
      const reply = (await browser.tabs.sendMessage(tab.id, {
        type: START_COLOR_PICKER,
      })) as { ok?: boolean; error?: string } | undefined;
      if (!reply?.ok) {
        throw new Error(reply?.error ?? "Color picking is unavailable here.");
      }
      window.close();
    } catch (error) {
      setPickerError(
        error instanceof Error
          ? error.message
          : "Color picking is unavailable on this page.",
      );
      setIsPicking(false);
    }
  };

  const copyColor = async () => {
    if (!pendingColor) return;
    try {
      await navigator.clipboard.writeText(pendingColor.hex.toUpperCase());
      setCopied(true);
    } catch {
      setPickerError("Could not copy the color.");
    }
  };

  const formats = pendingColor ? colorFormats(pendingColor.hex) : null;

  return (
    <main className="popup min-w-0">
      <header className="popup-header flex items-center justify-between">
        <span className="brand-logo">
          <img
            alt="Aska"
            className="brand-mark brand-mark-light"
            src="/aska-logo.svg"
          />
          <img
            alt=""
            aria-hidden="true"
            className="brand-mark brand-mark-dark"
            src="/aska-logo-dark.svg"
          />
        </span>
        <span className="extension-badge inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="extension-badge-dot" />
          BROWSER EXTENSION
        </span>
      </header>

      <section aria-labelledby="popup-title" className="hero">
        <div aria-hidden="true" className="hero-icon">
          <BookmarkPlus size={18} strokeWidth={1.7} />
        </div>
        <h1 id="popup-title">Save this page</h1>
        <p>Add the page you’re viewing to your Aska Inbox and keep it close.</p>
      </section>

      <button
        className="save-button transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        disabled={!isConnected}
        type="button"
      >
        <BookmarkPlus aria-hidden="true" />
        <span>Save to Inbox</span>
      </button>

      {!isConnected ? (
        <p className="connection-note">
          <LockKeyhole aria-hidden="true" />
          Connect your Aska account to start saving.
        </p>
      ) : null}

      <section aria-labelledby="color-title" className="color-section">
        <div className="color-section-heading">
          <span className="color-section-icon">
            <Pipette aria-hidden="true" size={15} />
          </span>
          <div>
            <h2 id="color-title">Pick a color</h2>
            <p>Sample a color from the page.</p>
          </div>
        </div>
        <button
          className="pick-color-button"
          disabled={isPicking}
          onClick={() => void pickColor()}
          type="button"
        >
          <Pipette aria-hidden="true" size={14} />
          {isPicking ? "Opening picker…" : "Use eyedropper"}
        </button>

        {pendingColor && formats ? (
          <div className="picked-color">
            <span
              aria-hidden="true"
              className="picked-color-swatch"
              style={{ backgroundColor: pendingColor.hex }}
            />
            <div className="picked-color-values">
              <strong>{pendingColor.hex.toUpperCase()}</strong>
              <span>{formats.rgb}</span>
              <span>{formats.hsl}</span>
            </div>
            <button
              aria-label={copied ? "Color copied" : "Copy color HEX code"}
              className="picked-color-copy"
              onClick={() => void copyColor()}
              type="button"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        ) : null}

        {pendingColor ? (
          <p className="color-pending-note">
            Selected color is ready to save when your account is connected.
          </p>
        ) : null}
        {pickerError ? (
          <p role="alert" className="picker-error">{pickerError}</p>
        ) : null}
      </section>

      <footer className="popup-footer flex items-center justify-between">
        <span>Made for your visual workspace</span>
        <a
          className="inline-flex items-center gap-1"
          href="https://aska-app.styltsou.com"
          rel="noreferrer"
          target="_blank"
        >
          Open Aska
          <ArrowUpRight aria-hidden="true" size={12} />
        </a>
      </footer>
    </main>
  );
}
