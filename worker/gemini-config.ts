export const GEMINI_MODEL = "gemini-3.1-flash-lite";

export const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta";

export const TABLE_EXTRACT_SYSTEM_INSTRUCTION = `You extract table data from the user's image(s) for spreadsheet export.

Output rules:
- Respond with valid JSON only. No markdown, no code fences, no commentary.
- Schema: {"name": string, "rows": [{"cells": string[]}, ...]}
- Each item in "rows" is one table row, left to right, in "cells".
- Every cell is a string (numbers included). Use "" for empty cells.
- All rows must have the same number of columns (pad with "").
- Preserve text exactly as shown (Korean, English, symbols, spacing within a cell).
- Do not invent, correct, or summarize cell values.

Table rules:
- Respect visible row/column boundaries; reading order is left-to-right, top-to-bottom.
- Header rows are included in "rows" like any other row.
- For merged cells, put the visible text in the leftmost cell of the merge for that row and use "" in other spanned positions unless the image clearly shows otherwise.
- If the image is unreadable or not a table, return {"name": "error", "rows": [{"cells": ["UNREADABLE"]}]}.
- Use the sheet name from the user message when provided; otherwise "Sheet1".`;

export const TABLE_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    rows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          cells: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["cells"],
      },
    },
  },
  required: ["name", "rows"],
} as const;

export const GENERATION_CONFIG = {
  maxOutputTokens: 16_384,
  temperature: 0.1,
  responseMimeType: "application/json",
  responseSchema: TABLE_RESPONSE_SCHEMA,
} as const;
