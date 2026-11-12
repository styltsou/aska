/** @jsxImportSource react */
import { Heading, Section, Text } from "@react-email/components";
import { colors, EmailLayout, textStyles } from "./layout";

export type CodeEmailProps = {
  /** The one-time code, already formatted for display is not required. */
  code: string;
  /** Minutes until the code expires. */
  expiresInMinutes: number;
};

/** Shared body for "here is your code" emails. The two public templates only
 * differ in their copy. */
export function CodeEmail({
  preview,
  title,
  intro,
  code,
  expiresInMinutes,
}: CodeEmailProps & { preview: string; title: string; intro: string }) {
  // 123456 -> "123 456", matching the grouped input on the sign-in pages.
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`.trim();
  return (
    <EmailLayout preview={preview}>
      <Heading as="h1" style={textStyles.heading}>
        {title}
      </Heading>
      <Text style={textStyles.paragraph}>{intro}</Text>
      <Section
        style={{
          backgroundColor: colors.codeBackground,
          border: `1px solid ${colors.border}`,
          borderRadius: "8px",
          padding: "18px 0",
          textAlign: "center",
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontFamily:
              "'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
            fontSize: "32px",
            fontWeight: 600,
            letterSpacing: "0.18em",
            lineHeight: "40px",
            margin: 0,
          }}
        >
          {spaced}
        </Text>
      </Section>
      <Text style={textStyles.small}>
        This code expires in {expiresInMinutes} minutes and can only be used
        once. Never share it with anyone; Mnemee will never ask you for it.
      </Text>
    </EmailLayout>
  );
}
