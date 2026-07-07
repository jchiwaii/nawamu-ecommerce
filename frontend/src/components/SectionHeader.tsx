import { PropsWithChildren } from "react";

export function SectionHeader({
  eyebrow,
  title,
  copy,
  children,
}: PropsWithChildren<{ eyebrow?: string; title: string; copy?: string }>) {
  return (
    <div className="section-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {copy ? <p>{copy}</p> : null}
      </div>
      {children ? <div className="section-actions">{children}</div> : null}
    </div>
  );
}
