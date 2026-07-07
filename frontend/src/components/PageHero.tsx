import { PropsWithChildren } from "react";

export function PageHero({
  eyebrow,
  title,
  copy,
  children,
}: PropsWithChildren<{ eyebrow: string; title: string; copy: string }>) {
  return (
    <section className="page-hero">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{copy}</p>
      {children}
    </section>
  );
}
