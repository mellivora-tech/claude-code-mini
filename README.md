# Claude Code Mini

A small Bun TypeScript CLI and TUI scaffold. It includes a JSON diff command, a schema command for the CLI data contracts, and a bounded Ink terminal render command.

## Setup

Install Bun, then install dependencies:

```sh
bun install
```

## Scripts

Run scripts with `bun run <script>`:

| Script | What it does |
| --- | --- |
| `dev` | Runs `src/index.ts` in Bun watch mode. |
| `start` | Runs the CLI entry point once. |
| `build` | Builds `src/index.ts` for Bun into `dist`. |
| `typecheck` | Runs TypeScript with `tsc --noEmit`. |
| `check` | Runs Biome checks. |
| `format` | Formats the project with Biome. |
| `test` | Runs the Bun test suite. |
| `smoke:diff` | Runs a sample `diff` command. |
| `smoke:schema` | Runs the `schema` command. |
| `smoke:tui` | Runs a sample `tui --message` command. |

## Commands

Run commands through the Bun entry point:

```sh
bun run src/index.ts diff "hello" "hello world"
bun run src/index.ts schema
bun run src/index.ts tui --message "hello terminal"
```

`diff <before> <after>` prints a structured JSON diff using `diff-match-patch`. Pass `--no-cleanup` to skip semantic diff cleanup.

`schema` prints the generated JSON schema for the CLI data contracts.

`tui --message <text>` renders a bounded terminal view with Ink.

The `diff` and `schema` commands write JSON to stdout. Logs are written to stderr.

## Stack

Key pieces in this scaffold:

| Area | Tools |
| --- | --- |
| Runtime and package manager | Bun |
| Language | TypeScript 5.x |
| CLI | Commander |
| Data contracts | Zod, zod-to-json-schema |
| Diffing | diff-match-patch |
| Logging | pino |
| Tests | bun:test |
| TUI rendering | Ink |

## Verification

After installing Bun and dependencies, run:

```sh
bun run typecheck
bun run check
bun run test
bun run smoke:diff
bun run smoke:schema
bun run smoke:tui
```

These commands check the TypeScript types, formatting and lint rules, tests, and the three command surfaces.
