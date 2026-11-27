export const EXTRACT_MODEL = 'gemini-3.5-flash-lite'
export const GROUP_MODEL = 'gemini-3.1-flash-lite'

export const GEMINI_API_BASE =
  'https://generativelanguage.googleapis.com/v1beta'

export const TABLE_EXTRACT_SYSTEM_INSTRUCTION = `You extract table data from the user's image(s) for spreadsheet export.

Multiple images may belong to one logical sheet: merge them into a single table.
- Use the header row from the image that clearly has column headers; include that header only once at the top.
- For images without a visible header row, append their data rows below the shared header in the order given in the user message.
- Do not duplicate header rows from headerless images.

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
- Header rows are included in "rows" like any other row when present in the source.
- For merged cells, put the visible text in the leftmost cell of the merge for that row and use "" in other spanned positions unless the image clearly shows otherwise.
- If any image is unreadable or not a table, return {"name": "error", "rows": [{"cells": ["UNREADABLE"]}]}.
- Use the sheet name from the user message when provided; otherwise "Sheet1".`

export const GROUP_SYSTEM_INSTRUCTION = `You group table crops that belong to the same logical spreadsheet sheet.

Rules:
- Tables with the same header columns (same structure and header text) belong in one group.
- Tables without visible headers should join the group whose column count and value types match best.
- Every table reference (T1, T2, ...) must appear in exactly one group.
- sheetName: short Korean label if headers are Korean, otherwise use the source language from the header text; keep names concise for Excel sheet tabs.

Respond with JSON only matching the response schema.`

export const TABLE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          cells: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['cells'],
      },
    },
  },
  required: ['name', 'rows'],
} as const

export const GROUP_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sheetName: { type: 'string' },
          tableRefs: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['sheetName', 'tableRefs'],
      },
    },
  },
  required: ['groups'],
} as const

export const EXTRACT_GENERATION_CONFIG = {
  maxOutputTokens: 32768,
  temperature: 0.1,
  responseMimeType: 'application/json',
  responseSchema: TABLE_RESPONSE_SCHEMA,
} as const

export const GROUP_GENERATION_CONFIG = {
  thinkingConfig: { thinkingLevel: 'low' },
  maxOutputTokens: 4096,
  temperature: 0,
  responseMimeType: 'application/json',
  responseSchema: GROUP_RESPONSE_SCHEMA,
} as const