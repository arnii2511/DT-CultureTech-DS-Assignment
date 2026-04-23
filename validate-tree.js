const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "deterministic-reflection-system.json");
const raw = fs.readFileSync(filePath, "utf8");
const tree = JSON.parse(raw);

function fail(message) {
  throw new Error(message);
}

function requireString(value, message) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(message);
  }
}

function requireArray(value, message) {
  if (!Array.isArray(value)) {
    fail(message);
  }
}

function requireSignals(node, messagePrefix) {
  requireArray(node.signals, `${messagePrefix} must include a signals array.`);
  if (node.signals.length < 1) {
    fail(`${messagePrefix} must include at least one signal tag.`);
  }
  for (const signal of node.signals) {
    requireString(signal, `${messagePrefix} has an invalid signal tag.`);
  }
}

function isInteractive(node) {
  return node && (node.type === "question" || node.type === "reflection");
}

function isFlowNode(node) {
  return node && ["start", "bridge", "summary", "terminal", "question", "reflection"].includes(node.type);
}

const nodes = tree.nodes;
if (!tree.startNode || typeof tree.startNode !== "string") {
  fail("Missing or invalid startNode.");
}

const nodeIds = Object.keys(nodes);
if (!nodes[tree.startNode]) {
  fail(`Start node does not exist: ${tree.startNode}`);
}

const axisConfig = {
  axis1: { label: "Locus", questions: 2, reflections: 1 },
  axis2: { label: "Orientation", questions: 2, reflections: 1 },
  axis3: { label: "Radius", questions: 2, reflections: 1 }
};

const axisCounts = {
  axis1: { questions: 0, reflections: 0 },
  axis2: { questions: 0, reflections: 0 },
  axis3: { questions: 0, reflections: 0 }
};

for (const [id, node] of Object.entries(nodes)) {
  if (!isFlowNode(node)) {
    fail(`Node ${id} has invalid type: ${node.type}`);
  }

  if (node.type === "start") {
    requireString(node.next, `Start node ${id} is missing next.`);
    requireSignals(node, `Start node ${id}`);
    continue;
  }

  if (node.type === "bridge") {
    requireString(node.fromAxis, `Bridge node ${id} is missing fromAxis.`);
    requireString(node.toAxis, `Bridge node ${id} is missing toAxis.`);
    requireString(node.next, `Bridge node ${id} is missing next.`);
    requireSignals(node, `Bridge node ${id}`);
    continue;
  }

  if (node.type === "summary") {
    requireString(node.next, `Summary node ${id} is missing next.`);
    requireSignals(node, `Summary node ${id}`);
    if (!node.summarySpec || typeof node.summarySpec !== "object") {
      fail(`Summary node ${id} is missing summarySpec.`);
    }
    requireArray(node.summarySpec.axisOrder, `Summary node ${id} summarySpec.axisOrder must be an array.`);
    requireArray(node.summarySpec.inputs, `Summary node ${id} summarySpec.inputs must be an array.`);
    continue;
  }

  if (node.type === "terminal") {
    if (node.next !== undefined) {
      fail(`Terminal node ${id} must not define next.`);
    }
    if (!node.result || typeof node.result !== "object") {
      fail(`Terminal node ${id} is missing result metadata.`);
    }
    requireString(node.result.status, `Terminal node ${id} is missing result.status.`);
    requireString(node.result.outcomeCode, `Terminal node ${id} is missing result.outcomeCode.`);
    requireString(node.result.reviewLevel, `Terminal node ${id} is missing result.reviewLevel.`);
    requireSignals(node, `Terminal node ${id}`);
    continue;
  }

  if (!node.axis || !axisConfig[node.axis]) {
    fail(`Interactive node ${id} has invalid axis: ${node.axis}`);
  }
  if (typeof node.axisName !== "string" || node.axisName !== axisConfig[node.axis].label) {
    fail(`Interactive node ${id} has invalid axisName: ${node.axisName}`);
  }
  requireString(node.prompt, `Interactive node ${id} is missing prompt.`);
  requireSignals(node, `Interactive node ${id}`);
  requireArray(node.options, `Interactive node ${id} must include options.`);
  if (node.options.length < 3 || node.options.length > 5) {
    fail(`Interactive node ${id} must have 3-5 options.`);
  }

  const optionIds = new Set();
  for (const option of node.options) {
    requireString(option.id, `Interactive node ${id} has an option with invalid id.`);
    if (optionIds.has(option.id)) {
      fail(`Interactive node ${id} has duplicate option id: ${option.id}`);
    }
    optionIds.add(option.id);
    requireString(option.label, `Interactive node ${id} option ${option.id} has invalid label.`);
    requireString(option.next, `Interactive node ${id} option ${option.id} has invalid next.`);
    requireSignals(option, `Interactive node ${id} option ${option.id}`);
    if (!nodes[option.next]) {
      fail(`Interactive node ${id} option ${option.id} points to missing node ${option.next}.`);
    }

    if (!option.signals.some((signal) => signal.startsWith(`${node.axis}:`))) {
      fail(`Interactive node ${id} option ${option.id} must include an axis-tagged signal.`);
    }
  }

  if (node.type === "question") {
    axisCounts[node.axis].questions += 1;
  } else if (node.type === "reflection") {
    axisCounts[node.axis].reflections += 1;
  }
}

for (const [axis, config] of Object.entries(axisConfig)) {
  if (axisCounts[axis].questions < config.questions) {
    fail(`Axis ${axis} must have at least ${config.questions} question nodes.`);
  }
  if (axisCounts[axis].reflections < config.reflections) {
    fail(`Axis ${axis} must have at least ${config.reflections} reflection node.`);
  }
}

const expectedLinearFlow = [
  ["START", "A1_Q1"],
  ["A1_REFLECT", "BRIDGE1"],
  ["BRIDGE1", "A2_Q1"],
  ["A2_REFLECT", "BRIDGE2"],
  ["BRIDGE2", "A3_Q1"],
  ["A3_REFLECT", "SUMMARY"],
  ["SUMMARY", "END"]
];

for (const [from, to] of expectedLinearFlow) {
  const node = nodes[from];
  if (!node) {
    fail(`Missing required flow node: ${from}`);
  }
  if (node.type === "question" || node.type === "reflection") {
    const allTargets = new Set(node.options.map((option) => option.next));
    if (from.endsWith("_REFLECT")) {
      if (allTargets.size !== 1 || !allTargets.has(to)) {
        fail(`Reflection node ${from} must route only to ${to}.`);
      }
    } else if (from.startsWith("A1_")) {
      for (const target of allTargets) {
        if (target !== "A1_Q2" && target !== "A1_REFLECT") {
          fail(`Axis 1 node ${from} may only route within axis 1.`);
        }
      }
    } else if (from.startsWith("A2_")) {
      for (const target of allTargets) {
        if (target !== "A2_Q2" && target !== "A2_REFLECT") {
          fail(`Axis 2 node ${from} may only route within axis 2.`);
        }
      }
    } else if (from.startsWith("A3_")) {
      for (const target of allTargets) {
        if (target !== "A3_Q2" && target !== "A3_REFLECT") {
          fail(`Axis 3 node ${from} may only route within axis 3.`);
        }
      }
    }
  } else if (node.type === "start" || node.type === "bridge" || node.type === "summary") {
    if (node.next !== to) {
      fail(`Flow break: ${from} must point to ${to}.`);
    }
  } else {
    fail(`Flow node ${from} has unexpected type ${node.type}.`);
  }
}

if (nodes.BRIDGE1.fromAxis !== "axis1" || nodes.BRIDGE1.toAxis !== "axis2") {
  fail("BRIDGE1 must connect axis1 to axis2.");
}
if (nodes.BRIDGE2.fromAxis !== "axis2" || nodes.BRIDGE2.toAxis !== "axis3") {
  fail("BRIDGE2 must connect axis2 to axis3.");
}

const visited = new Set();
const visiting = new Set();

function dfs(nodeId) {
  if (visiting.has(nodeId)) {
    fail(`Cycle detected at node ${nodeId}.`);
  }
  if (visited.has(nodeId)) {
    return;
  }

  const node = nodes[nodeId];
  if (!node) {
    fail(`Missing node encountered during traversal: ${nodeId}`);
  }

  visiting.add(nodeId);
  visited.add(nodeId);

  if (node.type === "question" || node.type === "reflection") {
    for (const option of node.options) {
      dfs(option.next);
    }
  } else if (node.type === "start" || node.type === "bridge" || node.type === "summary") {
    dfs(node.next);
  }

  visiting.delete(nodeId);
}

dfs(tree.startNode);

for (const id of nodeIds) {
  if (!visited.has(id)) {
    fail(`Unreachable node detected: ${id}`);
  }
}

console.log(`Tree valid: ${nodeIds.length} nodes, ${visited.size} reachable from ${tree.startNode}.`);
