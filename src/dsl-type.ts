export enum NodeType {
  Aggregate = "Aggregate",
  Actor = "Actor",
  Command = "Command",
  Event = "Event",
  Note = "Note",
  Query = "Query",
  Policy = "Policy",
  Error = "Error",
  ExternalSystem = "ExternalSystem",
  View = "View",
}

export enum ContainerType {
  Aggregate = "Aggregate",
  ExternalSystem = "ExternalSystem",
  ReadModel = "ReadModel",
  Process = "Process",
}

export interface Container {
  type: ContainerType;
  name: string;
  notes?: string[]; // Optional notes or comments about the container, which can provide additional context or information.
  children: Group[];
}

export interface Group {
  name: string; // The name of the process, e.g., the name of the command, event, policy, etc.
  nodes: Node[]; // The nodes that belong to this process, which can include commands, events, policies, etc.
  notes?: string[]; // Optional notes or comments about the process, which can provide additional context or information.
}

export interface Node {
  type: NodeType;
  name: string; // The name of the node, e.g., the name of the command, event, policy, etc.
  next?: string; // Represents the path taken when the node is executed or when the condition is met (for policies).
  negativeNext?: string; // For policies, this represents the path taken when the policy condition is not met.
  notes?: string[]; // Optional notes or comments about the node, which can provide additional context or information.
}