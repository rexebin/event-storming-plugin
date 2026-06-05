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
  name: string;
  next?: string;
  altNext?: string;
  notes?: string[];
}