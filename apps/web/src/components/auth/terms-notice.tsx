export function TermsNotice() {
  return (
    <p className="pt-6 pb-3 text-center text-[11px] leading-relaxed text-muted-foreground">
      By continuing, you agree to our{" "}
      <a
        className="text-foreground underline underline-offset-4"
        href="https://mnemee.space/terms"
        target="_blank"
        rel="noopener noreferrer"
      >
        Terms and Conditions
      </a>
      .
    </p>
  );
}
