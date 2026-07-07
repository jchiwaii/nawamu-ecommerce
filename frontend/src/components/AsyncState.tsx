import { PropsWithChildren } from "react";

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div className="state-block">
      <span className="loader" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="state-block error">
      <p>{message}</p>
    </div>
  );
}

export function EmptyBlock({ children }: PropsWithChildren) {
  return <div className="state-block empty">{children}</div>;
}
