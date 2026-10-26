import { Link } from "react-router";
import { routes } from "../routes";

export function Home() {
  const pages = routes.flatMap((r) => {
    const title = (r.handle as { title?: string } | undefined)?.title;
    return title && r.path && r.path !== "/" ? [{ path: r.path, title }] : [];
  });
  return (
    <main>
      <h1>Prototype</h1>
      <ul>
        {pages.map((p) => (
          <li key={p.path}>
            <Link to={p.path}>{p.title}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
