import { forwardRef, type InputHTMLAttributes } from "react";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    error?: string;
  }
>(function Input(
  { className = "", id, label, error, ...props },
  ref
) {
  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={id}
          className="mb-1 block text-sm font-medium text-ink"
        >
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={id}
        className={`w-full rounded-lg border border-navy/20 bg-white px-3 py-2 font-mono text-sm text-ink placeholder:text-muted focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy ${error ? "border-danger" : ""} ${className}`}
        {...props}
      />
      {error ? (
        <p className="mt-1 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});

Input.displayName = "Input";
