Plan: Refactor Container Parent Map

Context

DSLNode.rootContainerId is duplicated on every node (~9 assignment sites in dsl.ts) to track scoping boundaries. When a nested <container> element appears inside XML diagram elements, it creates a DSLSubGroup (flat { name, nodeIds, notes }) instead of a real container â there's no way to derive "which scope does this node belong to?" from the container model itself. This is a design smell: hierarchy information should live in containers, not duplicated on every node.

Goal: Add parentId/subContainers to DSLContainer, build proper container trees during parsing, eliminate rootContainerId from DSLNode, and derive scoping from the container hierarchy at reference resolution time.

Architecture Decisions

1. Scope boundary = immediate parent container. Two nodes can reference each other by name/id iff they share the same containerId (the DSLContainer that directly owns them). This is stricter than current behavior (which allows cross-sibling matching via shared rootContainerId) but eliminates the need for a redundant scope field on every node.
2. DSLSubGroup removed entirely. Nested <container> elements in XML create real DSLContainer objects with parentId pointing to their parent and subContainers[] on the parent.
3. No rootContainerId anywhere. Scope derivation happens dynamically at resolveReference call sites by looking up each node's containerId.
4. Text DSL stays flat for this refactor. Only XML nesting is updated. Text DSL can be enhanced in a follow-up PR.
5. Layout recursively collects nodes. Instead of flattening stepIds + subGroups, layout walks the container tree to gather all descendant nodes.

Data Structure Changes

src/dsl.ts

- DSLNode: Remove rootContainerId: string | null field
- DSLContainer: Add parentId: string | null, subContainers: DSLContainer[]
- DSLProcess: Remove subGroups?: DSLSubGroup[]

src/constants.ts

- Remove LayoutSubGroup interface
- Remove LayoutResult.subGroups array
- Remove SUB_GROUP_GAP_X constant (no longer needed)
- Add parentId: string | null, subContainers: Layouer

Implementation Steps
- Add parentId: string | null, subContainers: LayoutContainer[] to LayoutContainer

Implementation Steps

Phase 1: Data structures + scope helpers (dsl.ts)

1. Update DSLNode, DSLContainer, DSLProcess interfaces
2. Add ContainerScopeIndex type (maps node -> conta
3. Add helper functions for computing scope from the container tree

Phase 2: XML parsing rewrite (dsl.ts)

4. Rewrite collectXMLChildren: when encountering <container>, create a full DSLContainer with parentId, recurse into it. No subGroups
parameter.
5. Rewrite expandXMLContainer: populate child container's processes/nodes instead of creating flat process + subGroups
6. Update parseXMLDSL: build nested containers for hildren
7. Remove subGroups parameter from fillImplicitNext

Phase 3: Reference resolution (dsl.ts)

8. Rewrite resolveReference: scope by immediate con Use node's existing containerId as scope boundary.
9. Remove all rootContainerId assignments (~9 sites)

Phase 4: Text DSL parsing (dsl.ts)

10. Minor cleanup: remove rootContainerId from text (set to null or derive from containerId)

Phase 5: Layout rewrite (layout.ts)

11. Add helper to recursively collect all descendant nodeIds from a container tree
12. Update computeContainerWidth to work with nestees recursively)
13. Replace subGroup bounding box computation with recursive layout for child containers
14. Update any code that accesses process stepIds including subGroups

Phase 6: Renderer cleanup (renderer.ts)

15. Remove subGroupsGroup rendering and zoom transform update
16. Container rendering now handles all nesting via

Phase 7: Constants cleanup (constants.ts)

17. Remove LayoutSubGroup, DSLSubGroup import, SUB_GROUP_GAP_X

Phase 8: Test updates (dsl.test.ts, renderer.test.ts)

18. Update rootContainerId assertions to verify container hierarchy (parentId/subContainers)
19. Update tests that reference subGroups to use ne
20. Ensure all ~172+ tests pass with new structure

Verification

1. Run test suite: npm test â expect all existing tests to pass
2. Build VSIX via /vsix-build
3. Install VSIX in VSCode
4. Test a complex XML diagram with nested containers to verify rendering and link resolution