import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";

type RouterContextValue = {
  path: string;
  navigate: (path: string) => void;
};

const RouterContext = createContext<RouterContextValue | null>(null);

export function RouterProvider({ children }: PropsWithChildren) {
  const [path, setPath] = useState(() => window.location.pathname + window.location.search);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname + window.location.search);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const value = useMemo(
    () => ({
      path,
      navigate: (nextPath: string) => {
        window.history.pushState({}, "", nextPath);
        setPath(window.location.pathname + window.location.search);
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
    }),
    [path],
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) throw new Error("useRouter must be used inside RouterProvider");
  return context;
}

export function Link({
  to,
  children,
  className,
  ariaLabel,
}: PropsWithChildren<{ to: string; className?: string; ariaLabel?: string }>) {
  const router = useRouter();
  return (
    <a
      href={to}
      className={className}
      aria-label={ariaLabel}
      onClick={(event) => {
        event.preventDefault();
        router.navigate(to);
      }}
    >
      {children}
    </a>
  );
}
