import { Link } from "react-router";
import { routes } from "../routes";

export function Home() {
  const pages = routes.filter((r) => (r.handle as { title?: string } | undefined)?.title && r.path !== "/");
  return (
    <main>
      <h1>Prototype</h1>
      <ul>
        {pages.map((r) => (
          <li key={r.path}>
            <Link to={r.path!}>{(r.handle as { title: string }).title}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
