import { MantineProvider } from "@mantine/core";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";
import { render } from "vitest-browser-react";
import { expect } from "vite-plus/test";
import { page } from "vite-plus/test/browser/context";
import "@mantine/core/styles.css";
import "../index.css";
import { routeTree } from "../routeTree.gen.ts";
import { theme } from "../theme.ts";

export async function renderApp(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();

  const view = await render(
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <RouterProvider router={router} />
    </MantineProvider>,
  );

  await expect
    .element(page.getByRole("link", { name: "レシピGET" }))
    .toBeVisible();

  return view;
}
