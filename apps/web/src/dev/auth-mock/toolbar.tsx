import { useState, useSyncExternalStore, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";

import { mockStore } from "./mock-server";

type Go = (href: string) => void;

const TEST_EMAIL = "tester@example.com";

const VIEWS: Array<{ label: string; href: string }> = [
  { label: "Sign in", href: "/login" },
  { label: "Sign up", href: "/signup" },
  { label: "Verify email", href: `/verify-email?email=${TEST_EMAIL}` },
  { label: "Forgot password", href: "/forgot-password" },
  { label: "Reset password", href: `/reset-password?email=${TEST_EMAIL}` },
  { label: "Onboarding", href: "/onboarding" },
];

const panel: CSSProperties = {
  position: "fixed",
  right: 12,
  bottom: 12,
  zIndex: 2147483647,
  font: "12px/1.4 ui-sans-serif, system-ui, sans-serif",
  color: "#e8e8e8",
};

const card: CSSProperties = {
  width: 280,
  padding: 12,
  marginBottom: 8,
  borderRadius: 12,
  background: "rgba(24,24,27,0.96)",
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
};

const button: CSSProperties = {
  padding: "4px 8px",
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
};

const muted: CSSProperties = { color: "rgba(255,255,255,0.55)" };

function Toolbar({ go }: { go: Go }) {
  const [open, setOpen] = useState(false);
  const state = useSyncExternalStore(mockStore.subscribe, mockStore.get);

  return (
    <div style={panel}>
      {open ? (
        <div style={card}>
          <div style={{ marginBottom: 8 }}>
            <strong>Auth mock</strong>
            <div style={muted}>
              {state.user
                ? `Signed in as ${state.user.email} · ${state.workspaces.length} workspace${state.workspaces.length === 1 ? "" : "s"}`
                : "Signed out"}
            </div>
          </div>

          <div style={{ ...muted, marginBottom: 4 }}>Go to</div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              marginBottom: 10,
            }}
          >
            {VIEWS.map((view) => (
              <button
                key={view.href}
                style={button}
                type="button"
                onClick={() => go(view.href)}
              >
                {view.label}
              </button>
            ))}
          </div>

          <label style={{ display: "block", marginBottom: 6 }}>
            <span style={muted}>New sign-ins find </span>
            <select
              style={button}
              value={state.workspacesOnSignIn}
              onChange={(event) =>
                mockStore.update({
                  workspacesOnSignIn: event.target.value as "none" | "one",
                })
              }
            >
              <option value="none">no workspace (onboarding)</option>
              <option value="one">one workspace</option>
            </select>
          </label>

          <label style={{ display: "block", marginBottom: 10 }}>
            <span style={muted}>Network delay </span>
            <select
              style={button}
              value={state.latencyMs}
              onChange={(event) =>
                mockStore.update({ latencyMs: Number(event.target.value) })
              }
            >
              <option value={0}>none</option>
              <option value={400}>400 ms</option>
              <option value={1500}>1.5 s</option>
            </select>
          </label>

          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            <button
              style={button}
              type="button"
              onClick={() => {
                mockStore.signOut();
                go("/login");
              }}
            >
              Sign out
            </button>
            <button
              style={button}
              type="button"
              onClick={() => {
                mockStore.reset();
                go("/login");
              }}
            >
              Reset everything
            </button>
          </div>

          <div style={{ ...muted, fontSize: 11 }}>
            Any email and password signs in. Password <code>wrong</code> fails;
            an email containing <code>unverified</code> asks for a code and
            <code> taken</code> is already registered. Any 6-digit code works
            except <code>000000</code> (invalid); <code>999999</code> expires at
            the final reset step.
          </div>
        </div>
      ) : null}
      <button
        style={{ ...button, background: "rgba(24,24,27,0.96)" }}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        Auth mock {open ? "×" : "⚙"}
      </button>
    </div>
  );
}

export function mountToolbar(go: Go) {
  const host = document.createElement("div");
  host.id = "auth-mock-toolbar";
  document.body.append(host);
  createRoot(host).render(<Toolbar go={go} />);
}
