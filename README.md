# Deterministic Reflection Tree Agent

## Overview

This project is a deterministic TSV-driven reflection tree that runs from the command line. It uses rule-based traversal, stores answers and signals locally, and produces the same output for the same input every time. No LLM is used at runtime.

## Requirements

- Python 3.x

## How to Run

```bash
python python_cli_agent.py reflection-tree.tsv
```

If you want to run the repository's included tree file directly, use the TSV file that ships with the project.

## Project Files

- `python_cli_agent.py`
- `part1-tree.tsv`
- `validate-part1-tree.js`

## Validation

```bash
node validate-part1-tree.js
```
