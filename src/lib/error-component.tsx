import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const goQuotes = () => {
    try {
      sessionStorage.setItem("aarvaks_splash_seen", "1");
    } catch {
      /* ignore */
    }
    if (typeof window !== "undefined") window.location.assign("/");
  };
  return (
    <main
      className={
        "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center " +
        "bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
      }
    >
      <span className="text-red-500" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400">
        {error.message || "An unexpected error occurred. Your draft is still saved."}
      </p>
      <button
        type="button"
        onClick={goQuotes}
        className="mt-3 min-h-12 w-full max-w-xs rounded-xl bg-zinc-900 px-5 text-sm font-bold text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Quotes
      </button>
      <button
        type="button"
        onClick={() => {
          try {
            sessionStorage.setItem("aarvaks_splash_seen", "1");
          } catch {
            /* ignore */
          }
          if (typeof window !== "undefined") window.location.reload();
        }}
        className="min-h-12 w-full max-w-xs rounded-xl border-2 border-zinc-300 px-5 text-sm font-bold"
      >
        Try again
      </button>
    </main>
  );
}
