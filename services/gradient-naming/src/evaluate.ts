import { generateGradientName, type NameInput } from "./namer";

const fixtures: Array<{ label: string; input: NameInput }> = [
  {
    label: "cool coastal",
    input: {
      type: "linear",
      stops: [
        { name: "Prussian Blue", position: 0 },
        { name: "Turquoise", position: 100 },
      ],
    },
  },
  {
    label: "warm sunset",
    input: {
      type: "linear",
      stops: [
        { name: "Scarlet", position: 0 },
        { name: "Golden Yellow", position: 100 },
      ],
    },
  },
  {
    label: "muted pastel",
    input: {
      type: "radial",
      stops: [
        { name: "Lavender", position: 0 },
        { name: "Pale Pink", position: 100 },
      ],
    },
  },
  {
    label: "dark monochrome",
    input: {
      type: "linear",
      stops: [
        { name: "Black Pearl", position: 0 },
        { name: "Slate Gray", position: 100 },
      ],
    },
  },
  {
    label: "small accent",
    input: {
      type: "linear",
      stops: [
        { name: "Navy Blue", position: 0 },
        { name: "Navy Blue", position: 90 },
        { name: "Coral", position: 100 },
      ],
    },
  },
];

if (!process.env.GRADIENT_NAMING_PROVIDER) {
  throw new Error(
    "Set GRADIENT_NAMING_PROVIDER and its API key before evaluation",
  );
}
for (const fixture of fixtures) {
  const title = await generateGradientName(fixture.input);
  console.log(`${fixture.label}: ${title.trim()}`);
}
