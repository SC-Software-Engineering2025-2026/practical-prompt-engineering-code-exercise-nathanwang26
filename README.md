# practical-prompt-engineering-code-exercise

This repo serves to hold the code generated from the Frontend Masters workshop Practical Prompt Engineering

## Metadata tracking (prompt journal)

Implemented a small metadata system attached to prompts in the prompt library.

- Functions added (in `app.js`):
  - `trackModel(modelName: string, content: string): MetadataObject` — validates model name, sets `createdAt`/`updatedAt`, and computes a token estimate.
  - `updateTimestamps(metadata: MetadataObject): MetadataObject` — updates `updatedAt` (ISO 8601) and validates it is >= `createdAt`.
  - `estimateTokens(text: string, isCode: boolean): TokenEstimate` — returns `{min, max, confidence}` using the project's formula.

Validation rules and behavior:

- Model name: non-empty string, max 100 chars.
- Dates are ISO 8601 strings produced by `new Date().toISOString()`.
- Errors are thrown with descriptive messages on invalid inputs.

UI:

- The Add Prompt form now has `Model` and `Treat content as code` controls.
- Each prompt card shows: model, human-readable timestamps, and a token estimate badge color-coded by confidence (green/yellow/red).
- Prompts are sorted by `createdAt` descending.

To test locally: open `index.html` in a browser, add prompts, and inspect saved prompts and metadata. The data is stored in `localStorage` under key `prompt_library.prompts`.

## Export / Import

You can export all prompts (including metadata) to a JSON file and import them later.

Export schema:

{
version: "1.0",
exportedAt: "ISO 8601 timestamp",
stats: { totalPrompts, averageRating, mostUsedModel },
prompts: [ ... ]
}

How to use:

- Click `Export` to download a JSON file containing prompts and metadata.
- Click `Import` and select a previously exported file. If duplicate prompt IDs are found you'll be prompted to choose a resolution:
  - `keep` — keep existing prompts and ignore imported duplicates
  - `overwrite` — replace existing prompts with imported versions
  - `keepboth` — keep both; imported duplicates get new generated IDs

Import behavior includes:

- Backup of current `prompt_library.prompts` is automatically created in `localStorage` with a `.backup.` timestamp suffix.
- On failure, the import attempts to restore the backup and reports a detailed error message.
