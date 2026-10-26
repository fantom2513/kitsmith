import type { RouteObject } from "react-router";
import { Home } from "./pages/Home";

/**
 * The single place where pages are registered.
 * Give a route `handle: { title: "..." }` to list it on the Home page.
 */
export const routes: RouteObject[] = [{ path: "/", element: <Home />, handle: { title: "Home" } }];
