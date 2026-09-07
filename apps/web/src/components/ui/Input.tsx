import type { InputHTMLAttributes } from "react";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      className={`rounded-lg border border-zinc-300 px-2.5 py-1.5 text-base transition-shadow focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ring ${className}`}
      {...rest}
    />
  );
}
