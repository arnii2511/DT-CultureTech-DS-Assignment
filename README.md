# Deterministic Reflection Tree Agent

## Overview

This repository contains a deterministic, TSV-driven reflection tree that runs from the command line. It uses fixed node definitions, rule-based traversal, and stored signals to move through the tree without runtime LLM calls or external APIs.

The system is designed to be auditable and repeatable:

- the same TSV input always produces the same traversal
- questions use fixed options only
- decisions route from accumulated signals
- the summary is generated from stored traversal state

## Project Goals

- Provide a deterministic reflection flow
- Keep the tree logic in TSV form
- Make traversal simple to run from the CLI
- Preserve a clean, non-debug user experience
- Include complete sample execution transcripts

## Requirements

- Python 3.x
- Node.js for validation

## How to Run

Run the CLI against the included TSV tree:

```bash
python python_cli_agent.py part1-tree.tsv
```

You can also omit the filename because the CLI defaults to `part1-tree.tsv`:

```bash
python python_cli_agent.py
```

## What the Tree Does

The tree is organized into three ordered axes:

1. Axis 1 - Locus of Control
2. Axis 2 - Orientation (Contribution vs Entitlement)
3. Axis 3 - Radius of Impact

The flow is fixed:

`START -> Axis 1 -> Bridge -> Axis 2 -> Bridge -> Axis 3 -> Summary -> End`

Each axis uses:

- multiple question nodes to collect signals
- decision nodes to route by dominant accumulated signal
- reflection nodes to turn the reading into a more natural insight
- bridge nodes to move cleanly to the next axis

## Node Types

The TSV supports these node types:

- `start`
- `question`
- `decision`
- `reflection`
- `bridge`
- `summary`
- `end`

Behavior by type:

- `start` points into the first question
- `question` shows fixed options and records the selected answer
- `decision` reads accumulated signals and routes deterministically
- `reflection` prints a reflective transition and continues forward
- `bridge` advances to the next axis
- `summary` synthesizes the final reflection from stored signals
- `end` terminates the run

## CLI Input Handling

The CLI accepts cleaned inputs for question nodes:

- `1`, `2`, `3`
- `first`, `second`, `third`
- `option 1`, `option 2`, `option 3`
- whitespace around the input is ignored

If the input is empty or invalid, the CLI re-prompts instead of crashing.

## Files in This Repository

- `python_cli_agent.py` - CLI runner for the tree
- `part1-tree.tsv` - active TSV source of truth for the tree
- `deterministic-reflection-tree.tsv` - alternate tree export
- `deterministic-reflection-system.json` - JSON export of the system
- `reflection-tree.mmd` - Mermaid diagram source
- `reflection-tree-2026-04-23-154254.png` - rendered diagram preview
- `validate-part1-tree.js` - TSV validator for the active tree
- `validate-tree.js` - validator for the alternate tree export
- `transcript-1.md` - sample execution transcript for an external/entitled/self-centric path
- `transcript-2.md` - sample execution transcript for an internal/contributing/other-focused path

## Validation

Validate the active TSV tree with:

```bash
node validate-part1-tree.js
```

The validator checks:

- required node types exist
- question nodes have fixed options
- decision nodes have deterministic routing rules
- bridge nodes connect to the next axis
- summary node synthesizes agency, contribution, and radius
- all nodes are reachable
- there are no circular loops

## Sample Transcripts

Two complete, step-by-step transcripts are included in the repository:

- [`transcript-1.md`](./transcript-1.md)
- [`transcript-2.md`](./transcript-2.md)

Each transcript shows the full traversal, including question selection, recorded signal, decision routing, axis reflections, and the final summary.

## Example Output

The CLI prints only user-facing content:

- the question text
- numbered options
- reflective statements
- bridge transitions
- the final summary

It does not print node IDs, signal labels, or debugging details to the user.
