4. Non-process nodes get processIndex: -1 even inside process chains

parseNodeLine(line, containerId, -1, null) always passes -1. Named process groups (process: "Name" { ... }) add nodes to stepIds, but those nodes still have processIndex: -1. The text DSL inline processes (e.g. process: Actor -> Command -> Event) do set the index via ensureNode(..., stepIds.length).

Impact: Layout code that relies on processIndex for positioning won't distinguish between "this node is part of a process chain" and "this is a standalone element" for XML-parsed process groups. This could cause visual layout bugs in complex scenarios with mixed process + sub-container structures.