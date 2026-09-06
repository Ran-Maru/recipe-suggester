import { MantineProvider } from "@mantine/core";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";
import { render } from "vitest-browser-react";
import "@mantine/core/styles.css";
import "../index.css";
import { routeTree } from "../routeTree.gen.ts";
import { theme } from "../theme.ts";

export async function renderApp(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  return render(
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <RouterProvider router={router} />
    </MantineProvider>,
  );
}
