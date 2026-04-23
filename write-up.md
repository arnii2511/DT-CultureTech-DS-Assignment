## 1. Why These Specific Questions Were Chosen

The tree uses three axes because the system is trying to separate three different kinds of reflective signal instead of collapsing them into one vague response.

- **Axis 1: Locus of Control** checks whether the person frames events as something happening to them, something they can influence, or something they hold partly in balance.
- **Axis 2: Orientation** checks whether the person responds from a contribution mindset or from an entitlement mindset.
- **Axis 3: Radius of Impact** checks how far the effect extends: mostly self, shared, or mainly others.

Each axis has **four questions** because a single answer is not enough to make the reading stable. The sequence is intentionally ordered from **reaction -> action -> ownership -> reflection**. That progression matters: the first question captures the immediate reaction, the next checks what was done, the next checks what was owned, and the last asks for a forward-looking adjustment. This gives the system a fuller signal than a one-shot prompt.

The repetition is not there to create randomness. It is there to check **stability**. If the same axis signal appears across several questions, the tree can route with more confidence. If the answers vary, the system can still stay deterministic while treating the axis as mixed or balanced. In other words, repetition is a structural test of consistency, not a way to generate more content.

## 2. How Branching Was Designed and the Trade-Offs

Branching is deterministic by design. That choice was made so the tree can be audited, reproduced, and tested without depending on probabilistic text generation or an LLM at runtime. Every path is defined in the TSV, so the same answers always lead to the same route. This matters for correctness, debugging, and repeatable evaluation.

Question nodes and decision nodes are separated on purpose. Question nodes collect user input. Decision nodes do not ask anything new; they only interpret the accumulated signals and select the next reflective branch. That separation keeps the tree easier to reason about. It also prevents logic from being hidden inside prompt wording.

The system uses **signal accumulation** instead of single-response routing because one answer can be noisy. If routing depended only on the last response, the tree would be too fragile. Accumulated signals let the tree read the pattern across the whole axis, which is more stable and better aligned with the reflection goal. This also makes the system more deterministic: the choice is based on stored state, not on a free-form interpretation step.

Bridges between axes are fixed because the structure of the tree matters. Axis 1 must complete before Axis 2 begins, and Axis 2 must complete before Axis 3 begins. Fixed bridges ensure the flow does not skip, loop, or reorder axes.

The main trade-offs are straightforward:

- **Expressiveness vs determinism:** deterministic routing is easier to validate, but it gives less room for nuanced interpretation.
- **Simplicity vs nuance:** fixed axes and fixed options are simple to run and test, but they compress complex behavior into a small set of categories.
- **Auditability vs flexibility:** a fully declared tree is easy to inspect, but it is less flexible than a dynamic conversational system.
- **User experience vs structural rigidity:** users get a clean and predictable flow, but they cannot diverge outside the tree’s design.

The overall choice was to favor correctness and repeatability over adaptive conversation.

## 3. Psychological Sources Used

The tree is grounded in well-known psychological ideas, but it uses them as **structural inspiration**, not as a diagnostic or clinical tool.

**Rotter’s Locus of Control** informs Axis 1. The axis asks whether the person tends to see outcomes as internally influenced or externally driven. In this system, the labels and prompts are operationalized into a reflection structure that tracks control framing across multiple answers. It is not a formal psychometric test; it is a design pattern inspired by that model.

**Dweck’s Growth Mindset** informs Axis 2, but only indirectly. The tree uses **contribution vs entitlement** as a behavioral proxy for how the person approaches effort and participation. That is not a direct measurement of growth mindset. Instead, it is a simple way to reflect whether the person is acting from contribution, guarded balance, or entitlement. The framing is behavioral, not diagnostic.

**Maslow’s self-transcendence** and related self-versus-other orientation ideas inform Axis 3. The radius axis asks how far the impact reaches and who it affects. That creates a simple structural check for whether the response remains self-centered, becomes shared, or extends toward others. Again, this is not a clinical assessment. It is a reflective structure inspired by self-other orientation concepts.

The important constraint is that these sources are used as **conceptual scaffolding**, not as claims about mental health, personality diagnosis, or psychological truth.

## 4. What Would Be Improved With More Time

With more time, the biggest improvement would be **richer signal weighting**. Right now the tree uses simple dominant-signal logic. A stronger version could assign weights to early, repeated, or high-confidence answers while still staying deterministic.

The next improvement would be a **better natural-language summary layer**. The current summary is deterministic and structured, but it could be more polished by turning the stored axis state into a smoother, more readable reflection without changing the underlying logic.

A third improvement would be **better UI support** for showing axis state. For example, the CLI could display a small progress indicator, current axis name, or a compact history of already-answered signals. That would make the flow easier to follow without changing the tree itself.

Another useful improvement would be **adaptive questioning with deterministic rules**. The tree could stay rule-based while still varying depth based on earlier signals, such as asking an extra stabilizing question when an axis looks mixed. That would preserve determinism while improving precision.

The TSV schema could also be **formalized more strictly**. A schema or validator spec would make it easier to catch structural errors before runtime and would help future maintenance.

Finally, the system would benefit from a **better CLI experience or web interface** for users who do not want terminal interaction. A web version could still remain deterministic while making the experience more accessible. An analytics layer for repeated runs could also help compare patterns across sessions, as long as it stays clearly separate from the traversal logic.

Overall, the current system prioritizes deterministic structure, stable routing, and auditability. The next step would be to improve depth and presentation without weakening those guarantees.
