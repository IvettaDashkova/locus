import type { CheckResult, EvalCase, Suite } from "../types";
import { collectAct } from "@/lib/act/agent";

/** The seven tools the agent may call — anything outside this set is a hallucinated tool. */
const KNOWN = new Set(["geocode", "places_nearby", "route", "isochrone", "elevation", "weather", "sun_times"]);

/** Gemini free tier is ~20 requests/min and one task spends several. Pace cases to stay under it. */
const THROTTLE_MS = 22_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isTransient = (e: string) => /quota|rate|429|503|unavailable|exhausted|overload|timeout|fetch/i.test(e);

type ActCase = {
  name: string;
  task: string;
  /** Tools the agent must use to do the job. */
  expectTools: string[];
  /** A correct answer should match this (numbers/units pulled from a tool, not invented). */
  success: RegExp;
  /** Step budget: a tight agent shouldn't wander far past the tools it needs. */
  maxSteps: number;
};

const CASES: ActCase[] = [
  {
    name: "drive route Kyiv→Lviv",
    task: "How long does it take to drive from Kyiv to Lviv, and how far is it?",
    expectTools: ["geocode", "route"],
    success: /\d.*(km|kilomet|hour|hr|min)/i,
    maxSteps: 6,
  },
  {
    name: "places near a landmark",
    task: "Find cafes within 400 meters of the Eiffel Tower.",
    expectTools: ["geocode", "places_nearby"],
    success: /caf|\d|found|near/i,
    maxSteps: 6,
  },
  {
    name: "current weather",
    task: "What is the weather right now in Gdansk?",
    expectTools: ["geocode", "weather"],
    success: /-?\d+\s*°?\s*(c|deg|celsius)|temperat/i,
    maxSteps: 5,
  },
  {
    name: "sunset time",
    task: "What time is sunset today in Lviv?",
    expectTools: ["geocode", "sun_times"],
    success: /\d{1,2}[:.]\d{2}|sunset/i,
    maxSteps: 5,
  },
  {
    name: "walking isochrone",
    task: "Show the area reachable within 15 minutes walking from the center of Riga.",
    expectTools: ["geocode", "isochrone"],
    success: /15|minute|reach|area|isochron/i,
    maxSteps: 5,
  },
];

function actCase(c: ActCase): EvalCase {
  return {
    name: c.name,
    run: async (): Promise<CheckResult[]> => {
      await sleep(THROTTLE_MS); // respect the free-tier rate limit
      try {
        const { text, toolCalls, steps } = await collectAct(c.task);
        const names = toolCalls.map((t) => t.name);
        const flow = names.join("→") || "none";
        return [
          { metric: "task_success", pass: c.success.test(text), note: text.slice(0, 70).replace(/\n/g, " ") },
          { metric: "tool_choice", pass: c.expectTools.every((t) => names.includes(t)), note: flow },
          { metric: "no_hallucinated_tools", pass: names.every((n) => KNOWN.has(n)), note: flow },
          { metric: "step_efficiency", pass: steps <= c.maxSteps, score: steps },
        ];
      } catch (e) {
        const skip = isTransient(String(e));
        return [
          { metric: "task_success", pass: skip, note: skip ? "skipped: LLM unavailable" : String(e).slice(0, 70) },
        ];
      }
    },
  };
}

export const actSmoke: Suite = {
  module: "act",
  name: "smoke",
  cases: CASES.map(actCase),
};
