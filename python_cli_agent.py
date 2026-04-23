#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List


DEFAULT_TREE_FILE = "part1-tree.tsv"
QUESTION_TYPES = {"question"}
AUTO_ADVANCE_TYPES = {"start", "reflection", "bridge", "summary"}
DECISION_TYPE = "decision"
END_TYPE = "end"
VALID_TYPES = {"start", "question", "decision", "reflection", "bridge", "summary", "end"}
PLACEHOLDER_RE = re.compile(r"\{([A-Za-z0-9_]+)\.answer\}")


def fail(message: str) -> None:
    raise SystemExit(message)


def parse_json(value: str, default: Any) -> Any:
    if value is None:
        return default
    value = value.strip()
    if not value:
        return default
    return json.loads(value)


def load_tree(tsv_path: Path) -> List[Dict[str, Any]]:
    with tsv_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        expected = ["id", "parentId", "type", "text", "options", "target", "signal"]
        if reader.fieldnames != expected:
            fail(
                "TSV header must be exactly: "
                "id | parentId | type | text | options | target | signal"
            )

        rows = list(reader)

    if not rows:
        fail("TSV is empty.")

    nodes: List[Dict[str, Any]] = []
    seen = set()
    for raw in rows:
        row = {key: (raw.get(key) or "").strip() for key in expected}
        if not row["id"]:
            fail("Found blank node id.")
        if row["id"] in seen:
            fail(f"Duplicate node id: {row['id']}")
        seen.add(row["id"])

        if row["type"] not in VALID_TYPES:
            fail(f"Node {row['id']} has invalid type: {row['type']}")

        row["options_data"] = parse_json(row["options"], [])
        row["target_data"] = parse_json(row["target"], {})
        nodes.append(row)

    return nodes


def build_index(nodes: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    index = {node["id"]: node for node in nodes}
    if "START" not in index:
        fail("Missing START node.")
    if not any(node["type"] == END_TYPE for node in nodes):
        fail("Missing end node.")
    return index


def validate_tree(nodes: List[Dict[str, Any]], index: Dict[str, Dict[str, Any]]) -> None:
    if len(nodes) < 25:
        fail(f"Tree must have at least 25 nodes; found {len(nodes)}.")

    for node in nodes:
        node_type = node["type"]
        if node_type == "question":
            if not isinstance(node["options_data"], list) or not (3 <= len(node["options_data"]) <= 5):
                fail(f"Question node {node['id']} must have 3-5 options.")
            if "next" not in node["target_data"]:
                fail(f"Question node {node['id']} must have target.next.")
        elif node_type == "decision":
            if node["options_data"]:
                fail(f"Decision node {node['id']} must contain routing rules only and no options.")
            rules = node["target_data"].get("rules")
            if not isinstance(rules, list) or not rules:
                fail(f"Decision node {node['id']} must contain routing rules.")
            seen_when = set()
            for rule in rules:
                when = rule.get("when")
                nxt = rule.get("next")
                if not isinstance(when, str) or not isinstance(nxt, str):
                    fail(f"Decision node {node['id']} has an invalid routing rule.")
                if "any" in when:
                    fail(f"Decision node {node['id']} uses ambiguous routing condition {when}.")
                if when in seen_when:
                    fail(f"Decision node {node['id']} has duplicate routing condition {when}.")
                seen_when.add(when)
                if nxt not in index:
                    fail(f"Decision node {node['id']} routes to missing node {nxt}.")
        elif node_type == "reflection":
            if node["options_data"]:
                fail(f"Reflection node {node['id']} must not have options.")
            if "next" not in node["target_data"]:
                fail(f"Reflection node {node['id']} must have target.next.")
        elif node_type == "bridge":
            if node["options_data"]:
                fail(f"Bridge node {node['id']} must not have options.")
            if "nextAxis" not in node["target_data"] or "nextNode" not in node["target_data"]:
                fail(f"Bridge node {node['id']} must define nextAxis and nextNode.")
            if node["target_data"]["nextNode"] not in index:
                fail(f"Bridge node {node['id']} points to missing node {node['target_data']['nextNode']}.")
        elif node_type == "summary":
            if "next" not in node["target_data"]:
                fail(f"Summary node {node['id']} must have target.next.")
            summary_text = node["text"].lower()
            if "agency" not in summary_text or "contribution" not in summary_text or "radius" not in summary_text:
                fail("Summary node must synthesize agency, contribution, and radius.")
        elif node_type == "start":
            if "next" not in node["target_data"]:
                fail("Start node must have target.next.")
        elif node_type == END_TYPE:
            if node["target_data"]:
                fail("End node must not define a target.")

        if not node["signal"]:
            fail(f"Node {node['id']} is missing signal.")

    required_types = {"start", "question", "decision", "reflection", "bridge", "summary", "end"}
    seen_types = {node["type"] for node in nodes}
    missing_types = sorted(required_types - seen_types)
    if missing_types:
        fail(f"Missing required node types: {', '.join(missing_types)}")

    if not any("axis1" in node["signal"] for node in nodes):
        fail("Signals must be used for axis1.")
    if not any("axis2" in node["signal"] for node in nodes):
        fail("Signals must be used for axis2.")
    if not any("axis3" in node["signal"] for node in nodes):
        fail("Signals must be used for axis3.")

    # Reachability and loop check across all branches.
    seen = set()
    visiting = set()

    def visit(node_id: str) -> None:
        if node_id in visiting:
            fail(f"Circular loop detected at {node_id}.")
        if node_id in seen:
            return

        node = index.get(node_id)
        if node is None:
            fail(f"Missing node encountered during traversal: {node_id}")

        visiting.add(node_id)
        seen.add(node_id)

        node_type = node["type"]
        if node_type == "question":
            for option in node["options_data"]:
                visit(option["next"])
        elif node_type == "decision":
            for rule in node["target_data"]["rules"]:
                visit(rule["next"])
        elif node_type == "reflection":
            visit(node["target_data"]["next"])
        elif node_type == "bridge":
            visit(node["target_data"]["nextNode"])
        elif node_type == "summary":
            visit(node["target_data"]["next"])
        elif node_type == "start":
            visit(node["target_data"]["next"])
        elif node_type == END_TYPE:
            pass
        else:
            fail(f"Unexpected node type {node_type}.")

        visiting.remove(node_id)

    visit("START")

    if seen != set(index.keys()):
        missing = sorted(set(index.keys()) - seen)
        fail(f"Unreachable nodes: {', '.join(missing)}")


def interpolate(text: str, answers: Dict[str, Dict[str, str]]) -> str:
    def replace(match: re.Match[str]) -> str:
        node_id = match.group(1)
        answer = answers.get(node_id)
        if not answer:
            fail(f"Missing answer for placeholder {{{node_id}.answer}}.")
        return answer["answer"]

    return PLACEHOLDER_RE.sub(replace, text)


def axis_from_signal(signal: str) -> str:
    return signal.split(":", 1)[0] if signal else "unknown"


def record_signal(state: Dict[str, Any], signal: str) -> None:
    axis = axis_from_signal(signal)
    state["signal_tallies"][signal] += 1
    state["axis_tallies"][axis][signal] += 1


def normalize_choice(raw: str) -> str | None:
    token = re.sub(r"\s+", " ", raw.strip().lower())
    mapping = {
        "1": "1",
        "first": "1",
        "option 1": "1",
        "2": "2",
        "second": "2",
        "option 2": "2",
        "3": "3",
        "third": "3",
        "option 3": "3",
    }
    return mapping.get(token)


def prompt_question(node: Dict[str, Any]) -> None:
    print()
    print(f"Q: {node['text']}")
    for option in node["options_data"]:
        print(f"{option['id']}) {option['label']}")
    print()


def choose_option(node: Dict[str, Any], args: List[str], arg_index: int) -> tuple[Dict[str, Any], int]:
    options = node["options_data"]
    while True:
        prompt_question(node)
        if arg_index < len(args):
            raw_choice = args[arg_index]
            arg_index += 1
        else:
            print("Your answer: _")
            raw_choice = input()

        normalized = normalize_choice(raw_choice)
        if normalized is None:
            if raw_choice.strip() == "":
                if arg_index >= len(args):
                    print("Please enter 1, 2, or 3:")
                continue
            print("Invalid input. Please choose 1, 2, or 3.")
            continue

        matching = [opt for opt in options if opt["id"] == normalized]
        if matching:
            return matching[0], arg_index

        print("Invalid input. Please choose 1, 2, or 3.")


def route_decision(node: Dict[str, Any], state: Dict[str, Any]) -> str:
    rules = node["target_data"]["rules"]
    if node["target_data"].get("logic") == "dominant":
        best_rule = None
        best_score = -1
        for rule in rules:
            score = state["signal_tallies"].get(rule["when"], 0)
            if score > best_score:
                best_score = score
                best_rule = rule
        if best_rule is not None:
            return best_rule["next"]

    active_signals = state["active_signals"]
    matches = [rule for rule in rules if rule["when"] in active_signals]
    if len(matches) == 1:
        return matches[0]["next"]
    if len(matches) > 1:
        next_targets = {rule["next"] for rule in matches}
        if len(next_targets) == 1:
            return matches[0]["next"]
        fail(f"Ambiguous decision routing at {node['id']}.")

    next_targets = {rule["next"] for rule in rules}
    if len(next_targets) == 1:
        return rules[0]["next"]

    fail(f"No matching decision rule at {node['id']}.")


def run_tree(nodes: List[Dict[str, Any]], index: Dict[str, Dict[str, Any]], args: List[str]) -> None:
    state: Dict[str, Any] = {
        "answers": {},
        "signal_tallies": Counter(),
        "axis_tallies": defaultdict(Counter),
        "active_signals": set(),
    }

    current = "START"
    arg_index = 0

    while True:
        node = index[current]
        node_type = node["type"]
        record_signal(state, node["signal"])

        if node_type == "start":
            current = node["target_data"]["next"]
            continue

        if node_type in QUESTION_TYPES:
            option, arg_index = choose_option(node, args, arg_index)
            state["answers"][node["id"]] = {
                "answer": option["label"],
                "id": option["id"],
                "signal": option["signal"],
            }
            state["active_signals"].add(option["signal"])
            record_signal(state, option["signal"])
            current = option["next"]
            continue

        if node_type == DECISION_TYPE:
            next_node = route_decision(node, state)
            print("(Processing...)")
            current = next_node
            continue

        if node_type == "reflection":
            print(node["text"])
            current = node["target_data"]["next"]
            continue

        if node_type == "bridge":
            print("--- Moving to next section ---")
            current = node["target_data"]["nextNode"]
            continue

        if node_type == "summary":
            rendered = render_summary(node["text"], state)
            print(rendered)
            current = node["target_data"]["next"]
            continue

        if node_type == END_TYPE:
            break

        fail(f"Unsupported node type: {node_type}")

def dominant_signal(signal_names: List[str], signal_tallies: Counter) -> str:
    best_signal = signal_names[0]
    best_score = signal_tallies.get(best_signal, 0)
    for signal in signal_names[1:]:
        score = signal_tallies.get(signal, 0)
        if score > best_score:
            best_signal = signal
            best_score = score
    return best_signal


def synthesize_summary(state: Dict[str, Any]) -> str:
    axis1_signal = dominant_signal(["axis1:internal", "axis1:balanced", "axis1:external"], state["signal_tallies"])
    axis2_signal = dominant_signal(["axis2:contribution", "axis2:balanced", "axis2:entitlement"], state["signal_tallies"])
    axis3_signal = dominant_signal(["axis3:self", "axis3:mixed", "axis3:altrocentric"], state["signal_tallies"])

    axis1_phrase = {
        "axis1:internal": "agency leaned internal",
        "axis1:balanced": "agency stayed balanced",
        "axis1:external": "agency leaned external",
    }[axis1_signal]
    axis2_phrase = {
        "axis2:contribution": "contribution led",
        "axis2:balanced": "contribution stayed mixed",
        "axis2:entitlement": "entitlement showed up",
    }[axis2_signal]
    axis3_phrase = {
        "axis3:self": "radius stayed with self",
        "axis3:mixed": "radius stayed shared",
        "axis3:altrocentric": "radius reached others",
    }[axis3_signal]

    return (
        f"You showed {axis1_phrase}, {axis2_phrase}, and {axis3_phrase}. "
        "The pattern reads as agency, contribution, and radius working together."
    )


def render_summary(text: str, state: Dict[str, Any]) -> str:
    if PLACEHOLDER_RE.search(text):
        return interpolate(text, state["answers"])
    return synthesize_summary(state)


def resolve_tree_path(argv: List[str]) -> tuple[Path, List[str]]:
    if not argv:
        return Path(__file__).with_name(DEFAULT_TREE_FILE), []

    first = Path(argv[0])
    if first.exists() and first.suffix.lower() == ".tsv":
        return first, argv[1:]

    return Path(__file__).with_name(DEFAULT_TREE_FILE), argv


def main() -> None:
    tree_path, args = resolve_tree_path(sys.argv[1:])
    if not tree_path.exists():
        fail(f"TSV not found: {tree_path}")

    nodes = load_tree(tree_path)
    index = build_index(nodes)
    validate_tree(nodes, index)
    run_tree(nodes, index, args)


if __name__ == "__main__":
    main()
