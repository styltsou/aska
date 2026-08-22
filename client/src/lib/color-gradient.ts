export type GradientStop = {
  id: string;
  color: string;
  position: number;
};

export type GradientType = "linear" | "radial";

export function sortGradientStops(stops: GradientStop[]) {
  return [...stops].sort((a, b) => a.position - b.position);
}

export function gradientToCss(
  stops: Array<Pick<GradientStop, "color" | "position">>,
  type: GradientType,
  angle: number,
) {
  const stopList = [...stops]
    .sort((a, b) => a.position - b.position)
    .map((stop) => `${stop.color} ${stop.position}%`)
    .join(", ");

  return type === "radial"
    ? `radial-gradient(circle, ${stopList})`
    : `linear-gradient(${angle}deg, ${stopList})`;
}

export function colorAtPosition(stops: GradientStop[], position: number) {
  const sorted = sortGradientStops(stops);
  const nextIndex = sorted.findIndex((stop) => stop.position >= position);
  if (nextIndex <= 0) return sorted[0]?.color ?? "#000000";
  if (nextIndex === -1) return sorted.at(-1)?.color ?? "#000000";

  const before = sorted[nextIndex - 1]!;
  const after = sorted[nextIndex]!;
  const span = after.position - before.position;
  const amount = span === 0 ? 0 : (position - before.position) / span;
  const parse = (color: string) => {
    const value = color.replace("#", "");
    const expanded =
      value.length === 3 || value.length === 4
        ? [...value].map((part) => part + part).join("")
        : value;
    const channel = (start: number, fallback: number) => {
      const channel = Number.parseInt(expanded.slice(start, start + 2), 16);
      return Number.isFinite(channel) ? channel : fallback;
    };

    return {
      red: channel(0, 0),
      green: channel(2, 0),
      blue: channel(4, 0),
      alpha: expanded.length === 8 ? channel(6, 255) : 255,
    };
  };
  const start = parse(before.color);
  const end = parse(after.color);
  const channel = (from: number, to: number) =>
    Math.round(from + (to - from) * amount)
      .toString(16)
      .padStart(2, "0");
  const alpha = Math.round(start.alpha + (end.alpha - start.alpha) * amount);
  const rgb = `#${channel(start.red, end.red)}${channel(start.green, end.green)}${channel(start.blue, end.blue)}`;

  return alpha < 255 ? `${rgb}${alpha.toString(16).padStart(2, "0")}` : rgb;
}
