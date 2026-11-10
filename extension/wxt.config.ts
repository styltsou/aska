import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    // Without an explicit name WXT falls back to the package name.
    name: "Mnemee",
    permissions: ["activeTab", "storage"],
    host_permissions: [
      "https://api.mnemee.space/*",
      "http://*/*",
      "https://*/*",
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
