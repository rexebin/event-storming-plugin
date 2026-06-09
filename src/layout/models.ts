/**
 * Event Storming — Layout type definitions.
 */

import { DSLNode } from '../parser/';

// ─── Layout interfaces ───────────────────────────────────────

export interface LayoutNode extends DSLNode {
  x: number;
  y: number;
}

export interface LayoutContainer {
  id: string;
  label: string;
  type: 'aggregate' | 'readModel' | 'process' | 'externalSystem';
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  nodeIds: string[];
  notes?: string[];
}

export interface LayoutGroup {
  id: string;
  label: string;
  type: 'aggregate' | 'readModel' | 'process' | 'externalSystem';
  containerId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  notes?: string[];
}

export interface LayoutSubGroup {
  id: string;
  label: string;
  type: 'aggregate' | 'readModel' | 'process' | 'externalSystem';
  containerId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  notes?: string[];
}

export interface LayoutResult {
  width: number;
  height: number;
  containers: LayoutContainer[];
  groups: LayoutGroup[];
  subGroups: LayoutSubGroup[];
  nodes: LayoutNode[];
  links: LayoutLink[];
}

export interface LayoutLink {
  source: string;
  target: string;
  label: string;
  type: string;
}
