import {
  approveExtensionConnectionRequest,
  createExtensionConnectionRequest,
  exchangeExtensionConnectionRequest,
} from "@/controllers/extension-auth.controller";
import { factory } from "@/factory";

const extensionAuthRoutes = factory
  .createApp()
  .post("/extension/auth/requests", ...createExtensionConnectionRequest)
  .post(
    "/extension/auth/requests/:requestId/approve",
    ...approveExtensionConnectionRequest,
  )
  .post(
    "/extension/auth/requests/:requestId/exchange",
    ...exchangeExtensionConnectionRequest,
  );

export default extensionAuthRoutes;
