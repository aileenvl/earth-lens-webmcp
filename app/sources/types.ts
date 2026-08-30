import type { DomainError } from "../domain/types.ts";

export type SourceResult<T> =
  | { status: "ready"; data: T; fetchedAt: string; sourceUrl: string }
  | { status: "empty"; fetchedAt: string; sourceUrl: string; reason: string }
  | ({ status: "unavailable"; fetchedAt: string; sourceUrl: string } & DomainError);
