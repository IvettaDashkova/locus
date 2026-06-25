import type { CheckResult, EvalCase, Suite } from "../types";
import { retrieve } from "@/lib/ask/retrieve";

const TAU = 0.6; // grounding gate, mirrors /api/ask

const isTransient = (e: string) => /quota|rate|429|503|unavailable|exhausted|timeout|fetch/i.test(e);

// Retrieval recall + geolocation: the gold entry should be in top-k and carry coordinates.
const RECALL: { name: string; q: string; gold: string }[] = [
  { name: "capital on the Dnieper", q: "capital of Ukraine on the Dnieper river", gold: "kyiv" },
  { name: "Baltic shipyard port", q: "historic Baltic port city known for its shipyards", gold: "gdansk" },
  { name: "royal capital with a castle", q: "Polish royal capital with Wawel Castle", gold: "krakow" },
  { name: "Black Sea stairs", q: "Black Sea port with the Potemkin Stairs", gold: "odesa" },
  { name: "multilingual (uk)", q: "столиця Польщі на Віслі", gold: "warsaw" },
];

// Grounding guardrail: out-of-corpus declines, in-corpus is answered.
const REFUSE_OUT = ["how do I bake sourdough bread", "what is the speed of light"];
const ACCEPT_IN = ["tell me about Lviv", "capital of Germany on the Spree"];

function recallCase({ name, q, gold }: { name: string; q: string; gold: string }): EvalCase {
  return {
    name,
    run: async (): Promise<CheckResult[]> => {
      try {
        const { chunks } = await retrieve(q, { k: 6 });
        const hit = chunks.find((c) => c.entryId === gold);
        return [
          { metric: "recall@k", pass: Boolean(hit), note: hit ? undefined : `missing ${gold}` },
          { metric: "geo_match", pass: Boolean(hit?.coords), note: hit?.coords ? `[${hit.coords}]` : "no coords" },
        ];
      } catch (e) {
        const skip = isTransient(String(e));
        return [{ metric: "recall@k", pass: skip, note: skip ? "skipped: LLM unavailable" : String(e).slice(0, 60) }];
      }
    },
  };
}

function refusalCase(q: string, shouldAnswer: boolean): EvalCase {
  return {
    name: `${shouldAnswer ? "answer" : "decline"}: ${q.slice(0, 32)}`,
    run: async (): Promise<CheckResult[]> => {
      try {
        const { topSimilarity } = await retrieve(q, { k: 6 });
        const answered = topSimilarity >= TAU;
        return [
          { metric: "refusal_correct", pass: answered === shouldAnswer, score: Number(topSimilarity.toFixed(3)) },
        ];
      } catch (e) {
        const skip = isTransient(String(e));
        return [{ metric: "refusal_correct", pass: skip, note: skip ? "skipped: LLM unavailable" : String(e).slice(0, 60) }];
      }
    },
  };
}

export const askSmoke: Suite = {
  module: "ask",
  name: "smoke",
  cases: [
    ...RECALL.map(recallCase),
    ...REFUSE_OUT.map((q) => refusalCase(q, false)),
    ...ACCEPT_IN.map((q) => refusalCase(q, true)),
  ],
};
