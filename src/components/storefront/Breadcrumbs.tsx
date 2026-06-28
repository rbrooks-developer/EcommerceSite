import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5">
      <ol className="flex items-center gap-1 flex-wrap text-sm">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={i} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ opacity: 0.35 }} aria-hidden="true" />
              )}
              {isLast || !crumb.href ? (
                <span aria-current={isLast ? "page" : undefined} style={{ opacity: isLast ? 0.9 : 0.55 }}>
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="transition-opacity hover:opacity-100 hover:underline underline-offset-2"
                  style={{ opacity: 0.55 }}
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
