# Contributing

Quiet DM is an offline narrative oracle with an agent-first command interface.
Keep browser and CLI mechanics identical. Edit `src/engine.mjs`, regenerate
`engine.js` with `npm run build`, and run `npm test` on Node 20 or newer.
There are no runtime dependencies. Optional DOM checks are described in
`tools/dom-smoke.mjs`; the release was tested with jsdom 30.1.2.

Changes to saves or random behavior require migration/replay tests. Test
negative cases, stale revisions, exact retries, concurrency and interrupted
work. Preserve existing future rolls and user journals. Never truncate command
receipts to save space without an explicit versioned migration contract.

Do not commit personal saves, credentials or private journals. Use small,
fictional reproduction fixtures. The original examples are retained as
historical examples. Changes are contributed under the project's MIT license.
