import "./load-env";
import { retrieve } from "@/lib/ask/retrieve";

/** Eyeball hybrid retrieval: `npm run ask:try "your question"`. */
async function main() {
  const question = process.argv.slice(2).join(" ").trim() || "a port city on the Black Sea";
  const { chunks, topSimilarity } = await retrieve(question, { k: 6 });
  console.log(`\nquery: "${question}"`);
  console.log(`top similarity: ${topSimilarity.toFixed(3)}\n`);
  chunks.forEach((c, i) =>
    console.log(
      `${i + 1}. [${c.source}] ${c.title}  (rrf ${c.score.toFixed(4)}, sim ${c.similarity.toFixed(3)})\n   ${c.content
        .slice(0, 100)
        .replace(/\s+/g, " ")}…`,
    ),
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
