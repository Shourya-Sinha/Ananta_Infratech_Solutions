import { Link } from "react-router-dom";

/**
 * Internal paths (/…, #…) use the router so navigation stays in-app (and in
 * preview mode). Anything else (https:, mailto:, tel:) is a plain anchor.
 */
export function SmartLink({ href = "/", children, ...props }) {
  const isInternal = href.startsWith("/") && !href.startsWith("//");
  if (isInternal) {
    return (
      <Link to={href} {...props}>
        {children}
      </Link>
    );
  }
  const external = href.startsWith("http");
  return (
    <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...props}>
      {children}
    </a>
  );
}
