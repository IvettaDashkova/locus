export const LOCALES = ["en", "uk", "pl"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Native language names for the switcher. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  uk: "Українська",
  pl: "Polski",
};

type Dict = Record<string, string>;

const en: Dict = {
  "app.subtitle": "geospatial workspace",
  "lang.label": "Language",

  "nav.capture": "Capture",
  "nav.ask": "Ask",
  "nav.act": "Act",
  "nav.tracks": "Tracks",
  "nav.capture.hint": "Schema-driven geo forms",
  "nav.ask.hint": "Geospatial RAG assistant",
  "nav.act.hint": "Agent with map tools",
  "nav.tracks.hint": "Trajectory analytics",

  "module.comingSoon": "Coming soon. The foundation — map, PostGIS + pgvector, design system, and evals — is live.",
  "capture.blurb": "Build data-entry forms from a plain-English description; location fields are real map widgets.",
  "ask.blurb": "A geospatial RAG assistant over your data and open sources — cited answers and a map of mentioned places.",
  "act.blurb": "An agent with geo tools (geocode, route, isochrone, nearby, weather) exposed over MCP and used in-app.",
  "tracks.blurb": "Import GPS trajectories, compute movement metrics, play them back, and get an AI briefing.",

  "status.inDevelopment": "In development",
  "module.intro": "In active development — what it will showcase:",
  "ask.tech": "RAG, pgvector, hybrid search, reranking, cited answers",
  "act.tech": "MCP server, agent orchestration, tool-calling, Langfuse",
  "tracks.tech": "PostGIS analytics, Deck.gl, stop detection, data-viz",

  "capture.newForm": "New form",
  "capture.studioTitle": "Generate a form",
  "capture.studioDesc": "Describe a form in plain English — it’s generated, rendered, and saved with map location fields.",
  "capture.promptPlaceholder": "e.g. A field survey form with a site name, condition rating, notes, and a location.",
  "capture.example1": "A field survey form: site name, condition rating (poor/fair/good), inspector notes, and the location on a map.",
  "capture.example2": "A land parcel record: parcel id, owner, land use, and draw the boundary area on a map.",
  "capture.example": "Example {n}",
  "capture.generate": "Generate form",
  "capture.generating": "Generating…",
  "capture.schemaEditable": "JSON Schema (editable)",
  "capture.invalidJson": "invalid JSON",
  "capture.save": "Save submission",
  "capture.saving": "Saving…",
  "capture.savedWithSite": "Saved ✓ submission {id} · site “{site}”",
  "capture.saved": "Saved ✓ submission {id}",
  "capture.generateFailed": "Generation failed.",
  "capture.saveFailed": "Save failed.",
  "capture.previewEmpty": "Generate a form to preview it here.",
  "capture.fixJson": "Fix the JSON to preview the form.",

  "list.title": "Submissions",
  "list.empty": "No submissions yet. Create one with “New form”.",

  "detail.form": "Form",
  "detail.site": "Site",
  "detail.created": "Created",
  "detail.location": "Location",
  "detail.noLocation": "No location",
  "detail.data": "Data",
  "detail.flyTo": "Show on map",

  "geo.point.hint": "Click the map to set a location.",
  "geo.polygon.hint": "Click to add points; click the first point to close.",
  "geo.area": "Area",
  "geo.clear": "Clear",
};

const uk: Dict = {
  "app.subtitle": "геопросторовий робочий простір",
  "lang.label": "Мова",

  "nav.capture": "Збір",
  "nav.ask": "Запит",
  "nav.act": "Дія",
  "nav.tracks": "Треки",
  "nav.capture.hint": "Гео-форми за схемою",
  "nav.ask.hint": "Геопросторовий RAG-асистент",
  "nav.act.hint": "Агент з інструментами карти",
  "nav.tracks.hint": "Аналітика траєкторій",

  "module.comingSoon": "Незабаром. Фундамент — карта, PostGIS + pgvector, дизайн-система та evals — уже працює.",
  "capture.blurb": "Будуйте форми введення даних з опису простою мовою; поля локації — це справжні віджети карти.",
  "ask.blurb": "Геопросторовий RAG-асистент над вашими даними та відкритими джерелами — відповіді з цитатами й карта згаданих місць.",
  "act.blurb": "Агент з гео-інструментами (геокодування, маршрут, ізохрона, поруч, погода) через MCP, використовуваний у застосунку.",
  "tracks.blurb": "Імпортуйте GPS-траєкторії, рахуйте метрики руху, відтворюйте їх і отримуйте AI-бриф.",

  "status.inDevelopment": "В розробці",
  "module.intro": "В активній розробці — що буде показано:",
  "ask.tech": "RAG, pgvector, hybrid search, reranking, cited answers",
  "act.tech": "MCP server, agent orchestration, tool-calling, Langfuse",
  "tracks.tech": "PostGIS analytics, Deck.gl, stop detection, data-viz",

  "capture.newForm": "Нова форма",
  "capture.studioTitle": "Згенерувати форму",
  "capture.studioDesc": "Опишіть форму простою мовою — її згенерує, відрендерить і збереже з полями локації на карті.",
  "capture.promptPlaceholder": "напр. Форма польового обстеження з назвою обʼєкта, оцінкою стану, нотатками та локацією.",
  "capture.example1": "Форма польового обстеження: назва обʼєкта, оцінка стану (погано/задовільно/добре), нотатки інспектора та локація на карті.",
  "capture.example2": "Запис земельної ділянки: ідентифікатор, власник, призначення землі та межа ділянки на карті.",
  "capture.example": "Приклад {n}",
  "capture.generate": "Згенерувати форму",
  "capture.generating": "Генерування…",
  "capture.schemaEditable": "JSON Schema (редагована)",
  "capture.invalidJson": "некоректний JSON",
  "capture.save": "Зберегти запис",
  "capture.saving": "Збереження…",
  "capture.savedWithSite": "Збережено ✓ запис {id} · обʼєкт «{site}»",
  "capture.saved": "Збережено ✓ запис {id}",
  "capture.generateFailed": "Не вдалося згенерувати.",
  "capture.saveFailed": "Не вдалося зберегти.",
  "capture.previewEmpty": "Згенеруйте форму, щоб побачити її тут.",
  "capture.fixJson": "Виправте JSON, щоб побачити форму.",

  "list.title": "Записи",
  "list.empty": "Записів ще немає. Створіть перший через «Нова форма».",

  "detail.form": "Форма",
  "detail.site": "Обʼєкт",
  "detail.created": "Створено",
  "detail.location": "Локація",
  "detail.noLocation": "Без локації",
  "detail.data": "Дані",
  "detail.flyTo": "Показати на карті",

  "geo.point.hint": "Клікніть на карті, щоб задати локацію.",
  "geo.polygon.hint": "Клікайте, щоб додати точки; клік по першій точці — щоб замкнути.",
  "geo.area": "Площа",
  "geo.clear": "Очистити",
};

const pl: Dict = {
  "app.subtitle": "geoprzestrzenne środowisko pracy",
  "lang.label": "Język",

  "nav.capture": "Zbieranie",
  "nav.ask": "Pytaj",
  "nav.act": "Działaj",
  "nav.tracks": "Trasy",
  "nav.capture.hint": "Formularze geo oparte na schemacie",
  "nav.ask.hint": "Geoprzestrzenny asystent RAG",
  "nav.act.hint": "Agent z narzędziami mapy",
  "nav.tracks.hint": "Analityka trajektorii",

  "module.comingSoon": "Wkrótce. Fundament — mapa, PostGIS + pgvector, system projektowy i ewaluacje — już działa.",
  "capture.blurb": "Twórz formularze z opisu w zwykłym języku; pola lokalizacji to prawdziwe widżety mapy.",
  "ask.blurb": "Geoprzestrzenny asystent RAG nad Twoimi danymi i otwartymi źródłami — odpowiedzi z cytatami i mapa wymienionych miejsc.",
  "act.blurb": "Agent z narzędziami geo (geokodowanie, trasa, izochrona, w pobliżu, pogoda) udostępniony przez MCP i używany w aplikacji.",
  "tracks.blurb": "Importuj trajektorie GPS, licz metryki ruchu, odtwarzaj je i otrzymaj briefing AI.",

  "status.inDevelopment": "W rozwoju",
  "module.intro": "W aktywnym rozwoju — co pokaże:",
  "ask.tech": "RAG, pgvector, hybrid search, reranking, cited answers",
  "act.tech": "MCP server, agent orchestration, tool-calling, Langfuse",
  "tracks.tech": "PostGIS analytics, Deck.gl, stop detection, data-viz",

  "capture.newForm": "Nowy formularz",
  "capture.studioTitle": "Wygeneruj formularz",
  "capture.studioDesc": "Opisz formularz w zwykłym języku — zostanie wygenerowany, wyświetlony i zapisany z polami lokalizacji na mapie.",
  "capture.promptPlaceholder": "np. Formularz badania terenowego z nazwą obiektu, oceną stanu, notatkami i lokalizacją.",
  "capture.example1": "Formularz badania terenowego: nazwa obiektu, ocena stanu (zły/dostateczny/dobry), notatki inspektora i lokalizacja na mapie.",
  "capture.example2": "Rekord działki: identyfikator, właściciel, przeznaczenie i obrys granicy działki na mapie.",
  "capture.example": "Przykład {n}",
  "capture.generate": "Wygeneruj formularz",
  "capture.generating": "Generowanie…",
  "capture.schemaEditable": "JSON Schema (edytowalny)",
  "capture.invalidJson": "nieprawidłowy JSON",
  "capture.save": "Zapisz wpis",
  "capture.saving": "Zapisywanie…",
  "capture.savedWithSite": "Zapisano ✓ wpis {id} · obiekt „{site}”",
  "capture.saved": "Zapisano ✓ wpis {id}",
  "capture.generateFailed": "Nie udało się wygenerować.",
  "capture.saveFailed": "Nie udało się zapisać.",
  "capture.previewEmpty": "Wygeneruj formularz, aby zobaczyć go tutaj.",
  "capture.fixJson": "Popraw JSON, aby zobaczyć formularz.",

  "list.title": "Wpisy",
  "list.empty": "Brak wpisów. Utwórz pierwszy przez „Nowy formularz”.",

  "detail.form": "Formularz",
  "detail.site": "Obiekt",
  "detail.created": "Utworzono",
  "detail.location": "Lokalizacja",
  "detail.noLocation": "Brak lokalizacji",
  "detail.data": "Dane",
  "detail.flyTo": "Pokaż na mapie",

  "geo.point.hint": "Kliknij mapę, aby ustawić lokalizację.",
  "geo.polygon.hint": "Klikaj, aby dodać punkty; kliknij pierwszy punkt, aby zamknąć.",
  "geo.area": "Powierzchnia",
  "geo.clear": "Wyczyść",
};

export const messages: Record<Locale, Dict> = { en, uk, pl };
