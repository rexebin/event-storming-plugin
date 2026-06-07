Redundant semantics â could a single scope field do both jobs?

containerId serves two unrelated purposes:
- Placement: which LayoutContainer.nodeIds array to append to
- Matching: ensureNode checks n.containerId === containerId when looking up existing nodes

rootContainerId is used for a third, overlapping purpose:
- Boundary enforcement: resolveReference rejects cross-root references via n.rootContainerId === rootContainerId

The matching in ensureNode (line 472) uses containerId, but resolveReference uses rootContainerId. For non-nested nodes, these are identical. For nested sub-containers, containerId points to the leaf container while rootContainerId points to the process root. The duplication exists because both functions need the same scope info but the code tracks it with two fields that diverge in the nested case.

Impact: Every node creation path must set both values correctly. Any bug in one (e.g., forgetting to update rootContainerId during a refactor) silently breaks boundary enforcement while placement still works â a half-visible failure.

Suggestion: Consolidate to a single scopeId field if the only reason for two fields is that one is used for lookup and another for scoping. If those semantics need to diverge, encapsulate them in a helper like isInSameScope(a, b).