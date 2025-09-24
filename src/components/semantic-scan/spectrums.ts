export interface Spectrum {
  name: string;
  description: string;
  leftEndName: string;
  rightEndName: string;
}

export const bottleDesignSpectrum: Spectrum[] = [
  {
    name: "Assertiveness",
    description:
      "Captures how forcefully someone expresses themselves, ranging from gentle/soft-spoken to bold/confrontational. Affects conflict style, leadership approach, and social dynamics.",
    leftEndName: "mild",
    rightEndName: "aggressive",
  },
  {
    name: "Playfulness",
    description:
      "Reflects approach to life and interaction style, spanning from lighthearted/humorous to formal/grave. Influences workplace culture fit and social preferences.",
    leftEndName: "fun",
    rightEndName: "serious",
  },
  {
    name: "Temperature",
    description:
      "Measures emotional availability and approachability, going from affectionate/open to distant/reserved. Shapes relationship building and trust formation.",
    leftEndName: "warm",
    rightEndName: "cold",
  },
];
