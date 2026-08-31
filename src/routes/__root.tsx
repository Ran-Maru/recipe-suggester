import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import styles from "./__root.module.css";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <nav className={styles.nav}>
        <Link to="/" className={styles.link} activeOptions={{ exact: true }}>
          レシピGET
        </Link>
        <Link to="/recipes" className={styles.link}>
          一覧
        </Link>
      </nav>
      <Outlet />
      {import.meta.env.DEV ? <TanStackRouterDevtools /> : undefined}
    </>
  );
}
