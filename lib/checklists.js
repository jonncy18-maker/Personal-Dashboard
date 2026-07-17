// Travel checklist helpers (migration 010). A template item is {text, section};
// a trip-checklist item adds {done}. `section` is an optional group header
// (Toiletries, Tech, Docs…), the same flat-with-group-label shape as itinerary
// legs — items render grouped under their section, ungrouped when blank.

// Normalize a template's items to [{text, section}], dropping blank rows.
export function normalizeTemplateItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => ({
      text: typeof it?.text === 'string' ? it.text.trim() : '',
      section: typeof it?.section === 'string' ? it.section.trim() : '',
    }))
    .filter((it) => it.text);
}

// Normalize a trip checklist's items to [{text, section, done}].
export function normalizeChecklistItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => ({
      text: typeof it?.text === 'string' ? it.text.trim() : '',
      section: typeof it?.section === 'string' ? it.section.trim() : '',
      done: Boolean(it?.done),
    }))
    .filter((it) => it.text);
}

// Build a trip checklist's items from a template — copy text/section, all
// unchecked. The copy is what makes a template edit not disturb past trips.
export function instantiateItems(templateItems) {
  return normalizeTemplateItems(templateItems).map((it) => ({
    text: it.text,
    section: it.section,
    done: false,
  }));
}

// {done, total} for a checklist's items — real counts, no fabrication.
export function checklistProgress(items) {
  const list = Array.isArray(items) ? items : [];
  return {
    done: list.filter((it) => it?.done).length,
    total: list.length,
  };
}
