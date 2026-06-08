import { DSLModel } from '../parser/';

export type GSelection = any;

export interface DestroyableReturn {
  svg: any;
  model: DSLModel;
  destroy: () => void;
}
