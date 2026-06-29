# Sample corpus

`sample/places.json` holds a small set of short, original place summaries used to demo the **Ask**
(RAG) module. They are licensed **CC BY-SA** and carry a `url` to the corresponding Wikivoyage
article. **No bulk copyrighted corpora are committed.** For a real corpus, ingestion would pull
Wikivoyage (CC BY-SA) and OSM (ODbL) and keep their attribution per row (`chunks.license`).

`npm run ingest` embeds these via the AI SDK (Gemini `gemini-embedding-001`, 768-d) and also indexes
captured `sites` and `submissions`, so Ask answers over both open data and the user's own data.
