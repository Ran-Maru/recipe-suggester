import { createTheme } from "@mantine/core";
import type { MantineColorsTuple } from "@mantine/core";

// 元のサイトのブランドカラー #646cff を @mantine/colors-generator で 10 段階に展開したもの。
// #646cff は 3 番目に位置するため primaryShade も 3 に合わせている。
const brand: MantineColorsTuple = [
  "#e9ebff",
  "#cfd2ff",
  "#9ba1ff",
  "#646cff",
  "#3740fe",
  "#1b24fe",
  "#0916ff",
  "#000be4",
  "#0008cc",
  "#0004b4",
];

export const theme = createTheme({
  primaryColor: "brand",
  primaryShade: 3,
  autoContrast: true,
  colors: { brand },
});
