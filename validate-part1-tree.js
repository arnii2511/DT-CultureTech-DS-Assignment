const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "part1-tree.tsv");
const raw = fs.readFileSync(filePath, "utf8").trimEnd();
const lines = raw.split(/\r?\n/);

function fail(message) {
  throw new Error(message);
}

if (lines.length < 2) {
  fail("TSV must contain a header and at least one row.");
}

const header = lines[0].split("\t");
const expectedHeader = ["id", "parentId", "type", "text", "options", "target", "signal"];
if (header.length !== expectedHeader.length || header.some((cell, i) => cell !== expectedHeader[i])) {
  fail("TSV header must be exactly: id | parentId | type | text | options | target | signal");
}

const rows = lines.slice(1).map((line, index) => {
  const cols = line.split("\t");
  if (cols.length !== 7) {
    fail(`Row ${index + 2} must have exactly 7 TSV columns.`);
  }
  return {
    id: cols[0].trim(),
    parentId: cols[1].trim(),
    type: cols[2].trim(),
    text: cols[3].trim(),
    options: cols[4].trim(),
    target: cols[5].trim(),
    signal: cols[6].trim(),
  };
});

if (rows.length < 25) {
  fail(`Tree must have at least 25 nodes; found ${rows.length}.`);
}

const allowedTypes = new Set(["start", "question", "decision", "reflection", "bridge", "summary", "end"]);
const ids = new Set();
const byId = new Map();

for (const row of rows) {
  if (!row.id) fail("Every row must have an id.");
  if (ids.has(row.id)) fail(`Duplicate node id ${row.id}.`);
  ids.add(row.id);
  byId.set(row.id, row);
  if (!row.parentId) fail(`Node ${row.id} is missing parentId.`);
  if (!allowedTypes.has(row.type)) fail(`Node ${row.id} has invalid type ${row.type}.`);
  if (!row.signal) fail(`Node ${row.id} is missing signal.`);
}

const requiredTypes = ["start", "question", "decision", "reflection", "bridge", "summary", "end"];
for (const type of requiredTypes) {
  if (!rows.some((row) => row.type === type)) {
    fail(`Tree must include node type ${type}.`);
  }
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  return JSON.parse(value);
}

for (const row of rows) {
  const options = row.options ? parseJson(row.options, null) : null;
  const target = row.target ? parseJson(row.target, null) : null;

  if (row.type === "question") {
    if (!Array.isArray(options) || options.length < 3 || options.length > 5) {
      fail(`Question node ${row.id} must have 3-5 options.`);
    }
    if (!target || typeof target.next !== "string") {
      fail(`Question node ${row.id} must have a target with next.`);
    }
    for (const option of options) {
      if (typeof option.id !== "string" || typeof option.label !== "string" || typeof option.next !== "string") {
        fail(`Question node ${row.id} has an invalid option.`);
      }
      if (!byId.has(option.next)) {
        fail(`Question node ${row.id} option ${option.id} points to missing node ${option.next}.`);
      }
    }
  }

  if (row.type === "decision") {
    if (row.options && row.options !== "[]") {
      fail(`Decision node ${row.id} must contain routing rules only and no options.`);
    }
    if (!target || !Array.isArray(target.rules) || target.rules.length < 1) {
      fail(`Decision node ${row.id} must contain routing rules in target.`);
    }
    const seenWhen = new Set();
    for (const rule of target.rules) {
      if (typeof rule.when !== "string" || typeof rule.next !== "string") {
        fail(`Decision node ${row.id} has an invalid routing rule.`);
      }
      if (rule.when.includes("any")) {
        fail(`Decision node ${row.id} uses ambiguous routing condition ${rule.when}.`);
      }
      if (seenWhen.has(rule.when)) {
        fail(`Decision node ${row.id} has duplicate routing condition ${rule.when}.`);
      }
      seenWhen.add(rule.when);
      if (!byId.has(rule.next)) {
        fail(`Decision node ${row.id} routes to missing node ${rule.next}.`);
      }
    }
  }

  if (row.type === "reflection") {
    if (row.options && row.options !== "") {
      fail(`Reflection node ${row.id} must not have options.`);
    }
    if (!target || typeof target.next !== "string") {
      fail(`Reflection node ${row.id} must have a next target.`);
    }
    if (!byId.has(target.next)) {
      fail(`Reflection node ${row.id} points to missing node ${target.next}.`);
    }
  }

  if (row.type === "bridge") {
    if (row.options && row.options !== "") {
      fail(`Bridge node ${row.id} must not have options.`);
    }
    if (!target || typeof target.nextAxis !== "string" || typeof target.nextNode !== "string") {
      fail(`Bridge node ${row.id} must define nextAxis and nextNode in target.`);
    }
    if (!byId.has(target.nextNode)) {
      fail(`Bridge node ${row.id} points to missing node ${target.nextNode}.`);
    }
  }

  if (row.type === "summary") {
    if (!target || target.next !== "END") {
      fail("Summary node must point to END.");
    }
    const summaryText = row.text.toLowerCase();
    if (!summaryText.includes("agency") || !summaryText.includes("contribution") || !summaryText.includes("radius")) {
      fail("Summary node must synthesize agency, contribution, and radius.");
    }
    if (row.text.includes(".answer")) {
      fail("Summary node must not dump raw answer placeholders.");
    }
  }

  if (row.type === "start") {
    if (!target || target.next !== "A1_Q1") {
      fail("Start node must point to A1_Q1.");
    }
  }

  if (row.type === "end") {
    if (row.target !== "") {
      fail("End node must not define a target.");
    }
  }
}

const start = rows.find((row) => row.type === "start");
if (!start) fail("Missing start node.");
if (start.parentId !== "ROOT") fail("Start node must have parentId ROOT.");

const axisFirstIndex = {
  axis1: rows.findIndex((row) => row.signal.startsWith("axis1")),
  axis2: rows.findIndex((row) => row.signal.startsWith("axis2")),
  axis3: rows.findIndex((row) => row.signal.startsWith("axis3")),
};
if (!(axisFirstIndex.axis1 >= 0 && axisFirstIndex.axis2 >= 0 && axisFirstIndex.axis3 >= 0)) {
  fail("All 3 axes must be present.");
}
if (!(axisFirstIndex.axis1 < axisFirstIndex.axis2 && axisFirstIndex.axis2 < axisFirstIndex.axis3)) {
  fail("Axes must appear in order axis1, axis2, axis3.");
}

const seen = new Set();
const visiting = new Set();

function visit(nodeId) {
  if (visiting.has(nodeId)) {
    fail(`Circular loop detected at ${nodeId}.`);
  }
  if (seen.has(nodeId)) {
    return;
  }
  const node = byId.get(nodeId);
  if (!node) {
    fail(`Missing node encountered during traversal: ${nodeId}`);
  }

  visiting.add(nodeId);
  seen.add(nodeId);

  const target = node.target ? parseJson(node.target, null) : null;
  if (node.type === "question") {
    for (const option of parseJson(node.options, [])) {
      visit(option.next);
    }
  } else if (node.type === "decision") {
    for (const rule of target.rules) {
      visit(rule.next);
    }
  } else if (node.type === "reflection") {
    visit(target.next);
  } else if (node.type === "bridge") {
    visit(target.nextNode);
  } else if (node.type === "summary") {
    visit(target.next);
  } else if (node.type === "start") {
    visit(target.next);
  }

  visiting.delete(nodeId);
}

visit("START");

if (seen.size !== rows.length) {
  const missing = rows.map((row) => row.id).filter((id) => !seen.has(id));
  fail(`Unreachable nodes: ${missing.join(", ")}`);
}

console.log(`Tree valid: ${rows.length} nodes, all reachable, no loops.`);
