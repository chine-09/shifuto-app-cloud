import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-sm shadow-teal-900/10 hover:bg-brand-hover disabled:bg-teal-300 disabled:shadow-none",
  secondary:
    "bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-50 hover:border-zinc-400 disabled:text-zinc-400 disabled:hover:border-zinc-300",
  danger: "bg-red-600 text-white shadow-sm shadow-red-900/10 hover:bg-red-700 disabled:bg-red-300 disabled:shadow-none",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
