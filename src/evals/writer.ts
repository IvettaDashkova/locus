import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { EvalResult } from "./types";

/** Appends a run's results to src/evals/results/<timestamp>.jsonl (gitignored). */
export async function writeResults(results: EvalResult[], ts: string): Promise<string> {
  const dir = join(process.cwd(), "src/evals/results");
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${ts}.jsonl`);
  await writeFile(file, results.map((r) => JSON.stringify(r)).join("\n") + "\n");
  return file;
}
