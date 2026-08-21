declare module "color-namer" {
  type NamedColor = {
    name: string;
    hex: string;
    distance: number;
  };

  type NamerList = "basic" | "html" | "ntc" | "pantone" | "roygbiv" | "x11";

  function namer(
    color: string,
    options?: {
      pick?: NamerList[];
      omit?: NamerList[];
      distance?: "deltae" | "rgb";
    },
  ): Record<NamerList, NamedColor[]>;

  export = namer;
}
