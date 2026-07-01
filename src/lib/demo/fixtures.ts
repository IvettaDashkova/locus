import type { AskSource } from "@/components/ask/ask-pins-layer";

/**
 * Canned demo data for the gated AI modules. Anonymous visitors can't spend the shared AI budget, so
 * each module ships one pre-recorded, representative result that loads entirely client-side — no
 * fetch, no LLM, no keys, works offline and even when the daily quota is spent. The content mirrors
 * the real pipelines' output shape (citations + map pins for Ask, tool tags + GeoJSON for Act, a
 * Zod-valid schema + filled form for Capture) so the visualization is faithful to the live feature.
 */

// ── Ask ──────────────────────────────────────────────────────────────────────
export type AskDemo = { question: string; answer: string; sources: AskSource[] };

export const ASK_DEMO: AskDemo = {
  question: "What is there to see in the old town of Kraków?",
  answer:
    "Kraków's Old Town centres on the Main Market Square (Rynek Główny), one of the largest medieval squares in Europe, ringed by townhouses and the Cloth Hall [1]. St. Mary's Basilica on the square is known for its wooden altarpiece and the hejnał trumpet call sounded hourly from its taller tower [1]. Just south, Wawel Hill holds the royal castle and cathedral overlooking the Vistula [2].",
  sources: [
    {
      n: 1,
      title: "Kraków — Old Town",
      url: "https://en.wikivoyage.org/wiki/Krak%C3%B3w",
      source: "wikivoyage",
      license: "CC BY-SA 4.0",
      coords: [19.9373, 50.0617],
    },
    {
      n: 2,
      title: "Wawel Castle",
      url: "https://en.wikivoyage.org/wiki/Krak%C3%B3w",
      source: "wikivoyage",
      license: "CC BY-SA 4.0",
      coords: [19.9352, 50.0541],
    },
  ],
};

// ── Act ──────────────────────────────────────────────────────────────────────
export type ActDemo = { task: string; text: string; tools: string[]; features: GeoJSON.Feature[] };

const KYIV: [number, number] = [30.5234, 50.4501];
const LVIV: [number, number] = [24.0297, 49.8397];

export const ACT_DEMO: ActDemo = {
  task: "How long does it take to drive from Kyiv to Lviv, and what's the weather in Lviv?",
  text:
    "I geocoded both cities, routed between them by car, and checked the current conditions in Lviv.\n\n" +
    "• Kyiv → Lviv is about 540 km, roughly 7 h 10 min by car.\n" +
    "• Lviv right now: about 14 °C with light wind.\n\n" +
    "The route and both endpoints are on the map.",
  tools: ["geocode", "geocode", "route", "weather"],
  features: [
    { type: "Feature", geometry: { type: "Point", coordinates: KYIV }, properties: { label: "Kyiv", kind: "geocode" } },
    { type: "Feature", geometry: { type: "Point", coordinates: LVIV }, properties: { label: "Lviv", kind: "geocode" } },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        // A coarse representative polyline (Kyiv → Zhytomyr → Rivne → Lviv) — illustrative, not surveyed.
        coordinates: [KYIV, [28.6587, 50.2547], [26.2515, 50.6199], [25.3424, 50.0701], LVIV],
      },
      properties: { label: "540 km · 430 min", kind: "route" },
    },
  ],
};

// ── Capture ────────────────────────────────────────────────────────────────────
export type CaptureDemo = {
  prompt: string;
  jsonSchema: Record<string, unknown>;
  uiSchema: Record<string, unknown>;
  formData: Record<string, unknown>;
};

export const CAPTURE_DEMO: CaptureDemo = {
  prompt: "A field survey form for a site visit: site name, the location on a map, the surface condition, whether there is damage, and notes if damaged.",
  jsonSchema: {
    title: "Site Visit Survey",
    type: "object",
    properties: {
      site_name: { type: "string", title: "Site name" },
      location: { type: "object", title: "Location", format: "geo-point" },
      surface_condition: { type: "string", title: "Surface condition", enum: ["good", "fair", "poor"] },
      has_damage: { type: "boolean", title: "Any damage?" },
      damage_notes: { type: "string", title: "Damage notes" },
    },
    required: ["site_name", "location"],
    allOf: [
      {
        if: { properties: { has_damage: { const: true } }, required: ["has_damage"] },
        then: { required: ["damage_notes"] },
      },
    ],
  },
  uiSchema: {
    location: { "ui:field": "geoPoint", "ui:options": { siteLocation: true } },
    "ui:order": ["site_name", "location", "surface_condition", "has_damage", "damage_notes"],
  },
  formData: {
    site_name: "Riverside Pump Station",
    location: { type: "Point", coordinates: [30.5238, 50.4547] },
    surface_condition: "fair",
    has_damage: true,
    damage_notes: "Hairline cracking on the north retaining wall; recommend re-inspection in 30 days.",
  },
};
