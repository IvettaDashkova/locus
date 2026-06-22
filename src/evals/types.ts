/** Shared eval contracts. Each module registers one or more Suites (see ./index.ts). */

export type Module = "foundation" | "capture" | "ask" | "act" | "tracks";

export type CheckResult = {
  metric: string;
  pass: boolean;
  score?: number;
  note?: string;
};

export type EvalCase = {
  name: string;
  /** Runs the case and returns one or more metric checks. Throwing fails the case. */
  run: () => Promise<CheckResult[]>;
};

export type Suite = {
  module: Module;
  name: string;
  cases: EvalCase[];
};

/** One flattened, written record per metric check. */
export type EvalResult = CheckResult & {
  module: Module;
  suite: string;
  case: string;
  ts: string;
};
