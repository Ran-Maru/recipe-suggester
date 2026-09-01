import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Anchor, Container, Group } from "@mantine/core";
import styles from "./__root.module.css";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <Container size="xl" className={styles.container}>
      <Group className={styles.nav}>
        <Anchor
          component={Link}
          to="/"
          className={styles.link}
          activeOptions={{ exact: true }}
        >
          レシピGET
        </Anchor>
        <Anchor component={Link} to="/recipes" className={styles.link}>
          一覧
        </Anchor>
      </Group>
      <Outlet />
      {import.meta.env.DEV ? <TanStackRouterDevtools /> : undefined}
    </Container>
  );
}
