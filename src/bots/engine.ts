// A small UCI client for Stockfish. The browser build runs Stockfish 17.1 lite
// (single-threaded WASM) in a Web Worker from public/stockfish/, so it needs no
// special server headers. The playtest script drives the same engine from Node
// through the same class, using a different transport.

export const MATE_CP = 100000;

export interface EngineLine {
  /** First move of the line, UCI. With UCI_Chess960 on, castling is king-to-rook. */
  uci: string;
  /** Score from the side to move, in centipawns. Mates are +/-(MATE_CP - plies). */
  scoreCp: number;
  depth: number;
  multipv: number;
}

export interface AnalyseOptions {
  depth: number;
  multiPv: number;
  /** Restrict the search to these moves (UCI). */
  searchMoves?: string[];
  /** Safety cap per search, in milliseconds. */
  maxMs?: number;
}

/** Anything that can analyse a position: the real engine, or a fake in tests. */
export interface Analyser {
  analyse(fen: string, opts: AnalyseOptions): Promise<EngineLine[]>;
}

/** Sends UCI commands and receives output lines. */
export interface Transport {
  send(cmd: string): void;
  onLine(cb: (line: string) => void): void;
  close(): void;
}

/** Parses one `info ... multipv N score ... pv ...` line. Returns null for other lines. */
export function parseInfoLine(line: string): EngineLine | null {
  if (!line.startsWith("info ") || !line.includes(" pv ")) return null;
  const t = line.split(/\s+/);
  let depth = 0;
  let multipv = 1;
  let scoreCp: number | null = null;
  let uci = "";
  for (let i = 1; i < t.length; i++) {
    switch (t[i]) {
      case "depth":
        depth = Number(t[++i]);
        break;
      case "multipv":
        multipv = Number(t[++i]);
        break;
      case "score": {
        const kind = t[++i];
        const v = Number(t[++i]);
        if (kind === "cp") scoreCp = v;
        else if (kind === "mate") scoreCp = v > 0 ? MATE_CP - v : -MATE_CP - v;
        // A lowerbound/upperbound marker can follow; the value is still usable.
        break;
      }
      case "pv":
        uci = t[i + 1] ?? "";
        i = t.length;
        break;
    }
  }
  if (scoreCp === null || !uci) return null;
  return { uci, scoreCp, depth, multipv };
}

export class UciEngine implements Analyser {
  private listeners: ((line: string) => void)[] = [];
  private ready: Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();
  private lastSent = "";

  constructor(private transport: Transport) {
    const send = transport.send.bind(transport);
    transport.send = (cmd: string) => {
      this.lastSent = `${this.lastSent.split(" || ").slice(-2).join(" || ")} || ${cmd}`;
      send(cmd);
    };
    transport.onLine((line) => {
      for (const l of [...this.listeners]) l(line);
    });
    this.ready = (async () => {
      this.transport.send("uci");
      // Loading the WASM can be slow on an old phone.
      await this.waitFor((l) => l === "uciok", 90000);
      // Always 960 mode: standard positions work the same, and castling then
      // comes back as king-to-rook, which matches chessops.
      this.transport.send("setoption name UCI_Chess960 value true");
      this.transport.send("setoption name Hash value 16");
      await this.isReady();
    })();
    // Callers see a failed start when they next use the engine; don't crash on it now.
    this.ready.catch(() => undefined);
  }

  private waitFor(match: (line: string) => boolean, timeoutMs = 30000): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners = this.listeners.filter((l) => l !== listener);
        reject(new Error(`Stockfish did not answer in time (last sent: ${this.lastSent})`));
      }, timeoutMs);
      const listener = (line: string) => {
        if (match(line)) {
          clearTimeout(timer);
          this.listeners = this.listeners.filter((l) => l !== listener);
          resolve(line);
        }
      };
      this.listeners.push(listener);
    });
  }

  private async isReady(): Promise<void> {
    this.transport.send("isready");
    await this.waitFor((l) => l === "readyok");
  }

  /** Clears the hash between games. */
  newGame(): Promise<void> {
    return this.enqueue(async () => {
      await this.ready;
      this.transport.send("ucinewgame");
      await this.isReady();
    });
  }

  analyse(fen: string, opts: AnalyseOptions): Promise<EngineLine[]> {
    return this.enqueue(async () => {
      await this.ready;
      const lines = new Map<number, EngineLine>();
      const collect = (line: string) => {
        const info = parseInfoLine(line);
        if (info) lines.set(info.multipv, info);
      };
      this.listeners.push(collect);
      try {
        this.transport.send(`setoption name MultiPV value ${Math.max(1, opts.multiPv)}`);
        this.transport.send(`position fen ${fen}`);
        const search = opts.searchMoves?.length ? ` searchmoves ${opts.searchMoves.join(" ")}` : "";
        this.transport.send(`go depth ${opts.depth}${opts.maxMs ? ` movetime ${opts.maxMs}` : ""}${search}`);
        await this.waitFor((l) => l.startsWith("bestmove"), (opts.maxMs ?? 20000) + 10000);
      } finally {
        this.listeners = this.listeners.filter((l) => l !== collect);
      }
      return [...lines.values()].sort((a, b) => a.multipv - b.multipv);
    });
  }

  /** Sets a UCI option (used by the playtest to run fixed-Elo Stockfish opponents). */
  setOption(name: string, value: string | number | boolean): Promise<void> {
    return this.enqueue(async () => {
      await this.ready;
      this.transport.send(`setoption name ${name} value ${value}`);
      await this.isReady();
    });
  }

  /** Runs `go` with raw arguments and returns Stockfish's own bestmove. */
  go(fen: string, goArgs: string): Promise<string | null> {
    return this.enqueue(async () => {
      await this.ready;
      this.transport.send("setoption name MultiPV value 1");
      this.transport.send(`position fen ${fen}`);
      this.transport.send(`go ${goArgs}`);
      const line = await this.waitFor((l) => l.startsWith("bestmove"), 60000);
      const move = line.split(/\s+/)[1];
      return move && move !== "(none)" ? move : null;
    });
  }

  close(): void {
    this.transport.send("quit");
    this.transport.close();
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job, job);
    this.queue = run.catch(() => undefined);
    return run;
  }
}

/** Starts Stockfish in a Web Worker (browser only). */
export function createBrowserEngine(baseUrl: string = import.meta.env.BASE_URL): UciEngine {
  const worker = new Worker(`${baseUrl}stockfish/stockfish.js`);
  const transport: Transport = {
    send: (cmd) => worker.postMessage(cmd),
    onLine: (cb) => {
      worker.onmessage = (e: MessageEvent) => {
        for (const line of String(e.data).split("\n")) if (line) cb(line.trim());
      };
    },
    close: () => worker.terminate(),
  };
  return new UciEngine(transport);
}

let shared: UciEngine | null = null;

/** One engine for the whole app; it is created on first use. */
export function getSharedEngine(): UciEngine {
  shared ??= createBrowserEngine();
  return shared;
}
