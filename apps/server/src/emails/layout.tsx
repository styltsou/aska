/** @jsxImportSource react */
import type { ReactNode } from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

// Hosted by the marketing site (apps/website/public/email/). Email clients
// block or mangle SVG, so this is a PNG, and it must be an absolute public URL.
export const LOGO_URL = "https://mnemee.space/email/mnemee-logo.png";
const HOME_URL = "https://mnemee.space";

export const colors = {
  background: "#f4f4f5",
  card: "#ffffff",
  border: "#e4e4e7",
  text: "#171717",
  muted: "#71717a",
  codeBackground: "#f4f4f5",
};

const fontFamily =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Shared frame for every transactional email: logo, a white card, footer.
 * Colours are inline and light-only on purpose; clients recolour dark-mode
 * emails unpredictably, and a light card survives all of them. */
export function EmailLayout({
  preview,
  children,
}: {
  preview: string;
  children: ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: colors.background,
          fontFamily,
          margin: 0,
          padding: "40px 16px",
        }}
      >
        <Container style={{ maxWidth: "480px", margin: "0 auto" }}>
          <Link href={HOME_URL}>
            <Img
              alt="Mnemee"
              height={32}
              src={LOGO_URL}
              style={{ display: "block", margin: "0 0 24px 4px" }}
              width={122}
            />
          </Link>
          <Section
            style={{
              backgroundColor: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: "12px",
              padding: "32px",
            }}
          >
            {children}
          </Section>
          <Text
            style={{
              color: colors.muted,
              fontSize: "12px",
              lineHeight: "18px",
              margin: "20px 4px 0",
            }}
          >
            You received this email because of an action on your Mnemee account.
            If that wasn&apos;t you, you can safely ignore it.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const textStyles = {
  heading: {
    color: colors.text,
    fontSize: "22px",
    fontWeight: 600,
    letterSpacing: "-0.02em",
    lineHeight: "28px",
    margin: "0 0 12px",
  },
  paragraph: {
    color: colors.text,
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 20px",
  },
  small: {
    color: colors.muted,
    fontSize: "13px",
    lineHeight: "20px",
    margin: "20px 0 0",
  },
};
