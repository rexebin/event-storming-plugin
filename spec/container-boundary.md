Rules: 
the root level container element is the hard boundary of nodes.
1. nodes inside a root container should not be able to link to nodes in another root container. 
2. nodes can link to nodes sharing the same root <container>, for example, nodes in sub container A can link to sub container B if A and B share a root container C. 
3. Nodes in root container A or in its sub containers cannot link to another node in root container B or its sub containers.

Example root container in readme.md: 
1.  <container name="Complex Vertical Example"> 
2.  <container name="User Registration">

Example of sub container in readme.md:
<container name="PlaceOrder"> is a sub container of root container <container name="Place Order">
so <policy name="IsAddressValid" altNext="AddressIsInValid" /> can link to  <externalSystem name="InventoryService" /> inside the same root container, but it cannot link to any nodes outside of the root container <container name="Place Order">

Task: 
1. the current codebase have extra logic for allowing cross root container linking. Refactor and simplify the codebase as long as it satisfies the above rules.
2. add test cases to verify the above rules are satisfied.


Plan phase completed with below plan(in case the implementation doesn't satisfy the rules, we can use the plan to review and identify which part of the implementation is not correct and needs to be addressed): 

Revised Plan (simplified by "all nodes in containers")

1. Add rootContainerId field (src/dsl.ts:8)

rootContainerId: string | null; // parent container id (aggregate/readModel/process)

2. Track root scope in collectXMLChildren (src/dsl.ts:672-733)

- Add parameter currentRootScope: string (the dslContainer.id for the current context)
- When encountering a <container> child, switch to that container's id as new scope: pass subDslContainer.id as new scope into recursive call
- Every node created gets rootContainerId = currentRootScope

3. Update collectXMLChildren calls in parseXMLDSL (src/dsl.ts:583)

- Pass dslContainer.id as initial scope (process/aggregate/readModel root)

4. Update expandXMLContainer call (src/dsl.ts:576)

- When <container> is a child of a diagram element, use the container's own dslContainer.id as scope (new boundary)

5. Modify resolveReference (src/dsl.ts:780-818)

- Direct ID/customId match: search nodes with same rootContainerId first; if no match in same root, reject — no cross-root fallback
- Name-based lookup: scope strictly to same rootContainerId
- Fallback: create implicit error node in current root scope (matching the referencing node's rootContainerId)

6. Update implicit error node creation everywhere (src/dsl.ts:299,311,807)

- Set rootContainerId matching the referencing node's rootContainerId

7. Text DSL — no fallback for nodes without containers (src/dsl.ts:95-346)

- If user says ignore nodes outside containers, text DSL nodes with containerId=null stay that way — they won't participate in cross-container linking since there are no root boundaries to enforce among them

8. Add tests

- Same-root cross-sub-container linking (sub A → sub B within same parent)
- Cross-root linking blocked (node from one root creates implicit error when targeting node in different root)
- Nested sub-containers share parent's root scope
- README example XML still parses and links correctly

9. Update existing tests

- Any test expecting cross-container linking to work needs updating (they should now expect implicit error nodes instead)

10. <note> element without names are not nodes and should be gathered as notes to the parent element, this is the current behavior and should not be changed.