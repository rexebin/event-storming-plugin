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
  ReadModel = "ReadModel",
}

export enum DiagramType {
  Aggregate = "Aggregate",
  ExternalSystem = "ExternalSystem",
  Projector = "Projector",
  Process = "Process",
}

export interface Diagram {
  type: DiagramType;
  name: string;
  notes?: string[]; // Optional notes or comments about the container, which can provide additional context or information.
  containers: Container[];
}

export interface Container {
  name: string; 
  children: (Node | Container)[]; 
  notes?: string[]; 
}

export interface Node {
  type: NodeType;
  name: string; // The name of the node, e.g., the name of the command, event, policy, etc.
  next?: string; // Represents the path taken when the node is executed or when the condition is met (for policies).
  negativeNext?: string; // For policies, this represents the path taken when the policy condition is not met.
  notes?: string[]; // Optional notes or comments about the node, which can provide additional context or information.
}