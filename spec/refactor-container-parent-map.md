No reverse containerâparent map exists

The codebase has LayoutContainer.nodeIds (node â container), but no Container.parentId. This is why rootContainerId must be stored on every node â there's no way to derive "which root scope does this container belong to?" from the container model alone.

Impact: This is a design smell. Container hierarchy information should live in containers, not duplicated on every single node. If you add/remove a container, you'd have to update hundreds of nodes instead of one field.

Suggestion: Add parentId to DSLContainer. Then rootContainerId can be computed at parse time (walk up parentId chain) or removed entirely if scope checks use the container graph. This is a bigger refactor but would eliminate the per-node duplication.