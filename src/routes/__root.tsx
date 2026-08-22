import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <nav className="mb-6 flex justify-center gap-4">
        <Link
          to="/"
          className="text-brand hover:text-brand-hover [&.active]:font-bold"
          activeOptions={{ exact: true }}
        >
          レシピGET
        </Link>
        <Link
          to="/recipes"
          className="text-brand hover:text-brand-hover [&.active]:font-bold"
        >
          一覧
        </Link>
      </nav>
      <Outlet />
      {import.meta.env.DEV ? <TanStackRouterDevtools /> : undefined}
    </>
  );
}
