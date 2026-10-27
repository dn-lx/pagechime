export type ReaderAccount = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "reader";
};
export type ReaderSession = { account: ReaderAccount; expiresAt: string };
export type ReaderNote = {
  id: string;
  bookId: string;
  chapter: number;
  page: number;
  time: number;
  body: string;
  created: number;
  quote?: string;
  segment?: number;
  offset?: number;
  endSegment?: number;
  endOffset?: number;
  kind?: "note" | "highlight";
};
export type CloudItem = {
  key: string;
  value: Record<string, unknown> | null;
  revision: number;
};
export class ReaderApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export class ReaderNetworkError extends Error {}
export function readerClient(
  base: string,
  getToken: () => string | null = () => null,
  accountId?: string,
) {
  return async <T = any>(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> => {
    const token = getToken();
    let r: Response;
    try {
      r = await fetch(base + path, {
        method,
        headers: {
          ...(accountId ? { "X-Reader-Account": accountId } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: base.startsWith("/") ? "same-origin" : "omit",
        signal: AbortSignal.timeout(25000),
      });
    } catch {
      throw new ReaderNetworkError(
        "Check your connection. Your changes are kept on this device.",
      );
    }
    let b: any = {};
    try {
      b = await r.json();
    } catch {
      if (r.ok)
        throw new ReaderApiError(
          "The reader returned an invalid response.",
          502,
        );
    }
    if (!r.ok)
      throw new ReaderApiError(
        b.error || "The reader service is unavailable.",
        r.status,
      );
    return b as T;
  };
}
export type SyncSnapshot = {
  pending: Record<
    string,
    { value: Record<string, unknown> | null; revision: number }
  >;
  revisions: Record<string, number>;
};
/** Per-account durable outbox. Revisions prevent silent overwrites between devices. */
export class ReaderSync {
  private snapshot: SyncSnapshot;
  private closed = false;
  private running: Promise<void> | null = null;
  private queued = false;
  public error = "";
  public conflicts = false;
  constructor(
    private api: ReturnType<typeof readerClient>,
    private persist: (snapshot: SyncSnapshot) => void,
    initial: Partial<SyncSnapshot> = {},
    private onError: (message: string, status?: number) => void = () => {},
  ) {
    this.snapshot = {
      pending: initial.pending || {},
      revisions: initial.revisions || {},
    };
  }
  async start(apply: (items: CloudItem[]) => void | Promise<void>) {
    const { items } = await this.api<{ items: CloudItem[] }>("/state");
    for (const item of items) this.snapshot.revisions[item.key] = item.revision;
    this.persist(this.snapshot);
    await apply(items.filter((i) => !(i.key in this.snapshot.pending)));
    await this.flush();
  }
  change(key: string, value: Record<string, unknown> | null) {
    if (this.closed) return;
    if (this.running) this.queued = true;
    this.snapshot.pending[key] = {
      value,
      revision:
        this.snapshot.pending[key]?.revision ??
        this.snapshot.revisions[key] ??
        0,
    };
    this.persist(this.snapshot);
  }
  close() {
    this.closed = true;
  }
  async keepLocalChanges() {
    const { items } = await this.api<{ items: CloudItem[] }>("/state");
    const versions = new Map(items.map((i) => [i.key, i.revision]));
    for (const [key, entry] of Object.entries(this.snapshot.pending))
      entry.revision = versions.get(key) || 0;
    this.persist(this.snapshot);
    await this.flush();
  }
  flush(): Promise<void> {
    if (this.closed) return Promise.resolve();
    if (this.running) {
      this.queued = true;
      return this.running;
    }
    this.running = (async () => {
      this.error = "";
      this.conflicts = false;
      for (const [key, entry] of Object.entries(this.snapshot.pending)) {
        if (this.closed) break;
        try {
          const { revision } = await this.api<{ revision: number }>(
            "/state",
            "PUT",
            { key, value: entry.value, revision: entry.revision },
          );
          this.snapshot.revisions[key] = revision;
          if (
            this.snapshot.pending[key] &&
            this.snapshot.pending[key] !== entry
          )
            this.snapshot.pending[key].revision = revision;
          if (this.snapshot.pending[key] === entry)
            delete this.snapshot.pending[key];
          this.persist(this.snapshot);
        } catch (e) {
          this.error =
            e instanceof Error
              ? e.message
              : "Your changes are waiting to sync.";
          const status = e instanceof ReaderApiError ? e.status : undefined;
          if (status === 409) this.conflicts = true;
          this.onError(this.error, status);
          if (status !== 409) break;
        }
      }
    })().finally(() => {
      this.running = null;
      const again = this.queued;
      this.queued = false;
      if (again && !this.closed && !this.error) return this.flush();
    });
    return this.running;
  }
}
