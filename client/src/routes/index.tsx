import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSignedInDestination } from "@/lib/auth-flow";

export const Route = createFileRoute("/")({
  loader: async () => {
    const destination = await getSignedInDestination();
    throw redirect(destination);
  },
});
