import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    permissions: ["activeTab", "storage"],
    host_permissions: [
      "https://aska-api.styltsou.com/*",
      "http://*/*",
      "https://*/*",
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
