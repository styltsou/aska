declare global {
  interface WindowEventMap {
    "mnemee:scratchpad-open": CustomEvent;
  }
}

export {};
