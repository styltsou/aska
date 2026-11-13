import { useMemo, useState } from "react";
import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { LoaderCircleIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CenteredAuthLayout } from "@/components/auth/centered-auth-layout";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { clearAuthStateCache, getAuthState } from "@/lib/auth-flow";
import { slugFromTitle } from "@/lib/slug";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: async ({ location }) => {
    const state = await getAuthState();

    if (!state) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  head: () => ({
    meta: [{ title: "Create workspace | Mnemee" }],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const slug = useMemo(() => slugFromTitle(workspaceName), [workspaceName]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (!slug) {
      setError("Use a workspace name with at least one letter or number.");
      setIsSubmitting(false);
      return;
    }

    const { data, error } = await authClient.organization.create({
      name: workspaceName.trim(),
      slug,
    });

    if (error) {
      setError(error.message ?? "Unable to create this workspace.");
      setIsSubmitting(false);
      return;
    }

    clearAuthStateCache();
    await router.invalidate();
    void navigate({
      to: "/$workspaceSlug",
      params: { workspaceSlug: data.slug },
      replace: true,
    });
  }

  return (
    <CenteredAuthLayout>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Create workspace</h1>
        <p className="text-sm text-muted-foreground">
          This is where your collections will live.
        </p>
      </div>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <Input
          id="workspace-name"
          autoComplete="organization"
          placeholder="Workspace name"
          // Deliberate: focus the field as soon as this opens.
          // oxlint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          required
          value={workspaceName}
          onChange={(event) => setWorkspaceName(event.target.value)}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button className="w-full" disabled={isSubmitting} type="submit">
          {isSubmitting ? (
            <LoaderCircleIcon className="animate-spin" />
          ) : (
            <PlusIcon />
          )}
          <span>
            {isSubmitting ? "Creating workspace" : "Create workspace"}
          </span>
        </Button>
      </form>
    </CenteredAuthLayout>
  );
}
