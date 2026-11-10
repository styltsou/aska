import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-background px-6 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 grid place-items-center text-[clamp(12rem,35vw,32rem)] leading-none font-black tracking-[0.018em] text-muted select-none"
      >
        404
      </div>
      <BrandLogo className="absolute top-[1rem] left-[1rem] max-[62rem]:top-6 max-[62rem]:left-6" />
      <section className="relative z-10 w-full max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
          This page doesn’t exist.
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
          Check the address, or return to your workspace to keep organizing your
          ideas.
        </p>
        <div className="mt-8 flex justify-center">
          <Button render={<Link to="/" />} size="lg">
            Go to workspace
          </Button>
        </div>
      </section>
    </main>
  );
}
