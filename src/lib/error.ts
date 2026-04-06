import { ApiError } from "@/lib/api-client";

export function safeErrText(error: unknown): string {
  if (error instanceof ApiError)
    return `${error.message} (HTTP ${error.status})`;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return String(error);
}
