import type { RenderableTreeNode } from './types';

let idCounter = 0;
const getId = (): string => {
  return `node-${idCounter++}`;
};

export default class Tag<
  N extends string = string,
  A extends Record<string, any> = Record<string, any>
> {
  readonly $$mdtype = 'Tag' as const;

  readonly id = getId();

  static isTag = (tag: any): tag is Tag => {
    return !!(tag?.$$mdtype === 'Tag');
  };

  name: N;
  attributes: A;
  children: RenderableTreeNode[];

  constructor(
    name = 'div' as N,
    attributes = {} as A,
    children: RenderableTreeNode[] = []
  ) {
    this.name = name;
    this.attributes = attributes;
    this.children = children;
  }
}
