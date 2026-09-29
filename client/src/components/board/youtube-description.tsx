import { Fragment, type MouseEvent, type ReactNode, type Ref } from "react";

type DescriptionSegment =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string }
  | { type: "hashtag"; value: string }
  | { type: "timestamp"; value: string; seconds: number };

const DESCRIPTION_TOKEN_PATTERN =
  /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|\b(?:(\d+):)?(\d{1,2}):(\d{2})\b|(?<![\p{L}\p{N}_])#[\p{L}\p{N}_]+/giu;
const TRAILING_URL_PUNCTUATION = /[.,!?;:]+$/;

export function parseYouTubeDescription(
  description: string,
): DescriptionSegment[] {
  const segments: DescriptionSegment[] = [];
  let cursor = 0;

  for (const match of description.matchAll(DESCRIPTION_TOKEN_PATTERN)) {
    const token = match[0];
    const index = match.index;
    if (index > cursor)
      segments.push({ type: "text", value: description.slice(cursor, index) });

    const timestamp = parseTimestampMatch(match);
    if (timestamp !== null) {
      segments.push({ type: "timestamp", value: token, seconds: timestamp });
      cursor = index + token.length;
      continue;
    }

    if (token.startsWith("#")) {
      segments.push({ type: "hashtag", value: token });
      cursor = index + token.length;
      continue;
    }

    const trimmed = trimUrlPunctuation(token);
    const href = normalizeDescriptionUrl(trimmed.value);
    if (href) {
      segments.push({ type: "link", value: trimmed.value, href });
      if (trimmed.remainder) {
        segments.push({ type: "text", value: trimmed.remainder });
      }
      cursor = index + token.length;
      continue;
    }

    segments.push({ type: "text", value: token });
    cursor = index + token.length;
  }

  if (cursor < description.length) {
    segments.push({ type: "text", value: description.slice(cursor) });
  }

  return segments.reduce<DescriptionSegment[]>((normalized, segment) => {
    const previous = normalized.at(-1);
    if (segment.type === "text" && previous?.type === "text") {
      previous.value += segment.value;
    } else {
      normalized.push(segment);
    }
    return normalized;
  }, []);
}

function parseTimestampMatch(match: RegExpMatchArray): number | null {
  if (match[1] === undefined) {
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    return seconds < 60 ? minutes * 60 + seconds : null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (minutes >= 60 || seconds >= 60) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

function trimUrlPunctuation(value: string) {
  let trimmed = value.replace(TRAILING_URL_PUNCTUATION, "");
  while (trimmed.endsWith(")")) {
    const openCount = [...trimmed].filter(
      (character) => character === "(",
    ).length;
    const closeCount = [...trimmed].filter(
      (character) => character === ")",
    ).length;
    if (closeCount <= openCount) break;
    trimmed = trimmed.slice(0, -1);
  }
  return { value: trimmed, remainder: value.slice(trimmed.length) };
}

function normalizeDescriptionUrl(value: string): string | null {
  const candidate = value.startsWith("www.") ? `https://${value}` : value;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function youtubeTimestampUrl(videoId: string, seconds: number): string {
  const url = new URL(
    `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
  );
  url.searchParams.set("t", String(Math.max(0, Math.floor(seconds))));
  return url.toString();
}

export function YouTubeDescription({
  description,
  videoId,
  className,
  ref,
  interactive = true,
  onTimestampSeek,
}: {
  description: string;
  videoId: string;
  className?: string;
  ref?: Ref<HTMLParagraphElement>;
  interactive?: boolean;
  onTimestampSeek?: (seconds: number) => boolean;
}) {
  const segments = parseYouTubeDescription(description);
  const content: ReactNode[] = segments.map((segment, index) => {
    if (segment.type === "text") {
      return <Fragment key={`${index}-text`}>{segment.value}</Fragment>;
    }

    if (segment.type === "link") {
      const linkClassName = interactive
        ? "text-muted-foreground underline decoration-current/40 underline-offset-2 transition-colors duration-100 ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-foreground hover:decoration-current motion-reduce:transition-none"
        : "underline decoration-current/40 underline-offset-2";
      if (!interactive) {
        return (
          <span key={`${index}-${segment.value}`} className={linkClassName}>
            {segment.value}
          </span>
        );
      }
      return (
        <a
          key={`${index}-${segment.value}`}
          href={segment.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${linkClassName} focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`}
          onClick={(event) => event.stopPropagation()}
        >
          {segment.value}
        </a>
      );
    }

    if (segment.type === "hashtag") {
      return (
        <span
          key={`${index}-${segment.value}`}
          className="font-semibold text-primary/90"
        >
          {segment.value}
        </span>
      );
    }

    const timestampClassName =
      "font-medium text-foreground underline decoration-current/40 underline-offset-2 hover:decoration-current";
    if (!interactive) {
      return (
        <span key={`${index}-${segment.value}`} className={timestampClassName}>
          {segment.value}
        </span>
      );
    }

    return (
      <a
        key={`${index}-${segment.value}`}
        href={youtubeTimestampUrl(videoId, segment.seconds)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${timestampClassName} focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`}
        aria-label={`Seek video to ${segment.value}`}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          event.stopPropagation();
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          ) {
            return;
          }
          if (onTimestampSeek?.(segment.seconds)) event.preventDefault();
        }}
      >
        {segment.value}
      </a>
    );
  });

  return (
    <p ref={ref} className={className}>
      {content}
    </p>
  );
}
