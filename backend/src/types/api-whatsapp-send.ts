export type ResolvedConnection = {
  connectionId: string;
};

export type ResolveConnectionResult =
  | { ok: true; value: ResolvedConnection }
  | { ok: false; response: unknown };
