import type { Location, RenderableTreeNode } from './types';

let idCounter = 0;
const getId = (): string => {
  return `tag-${idCounter++}`;
};

export default class Tag<
  N extends string = string,
  A extends Record<string, any> = Record<string, any>
> {
  readonly $$mdtype = 'Tag' as const;

  static isTag = (tag: any): tag is Tag => {
    return !!(tag?.$$mdtype === 'Tag');
  };

  constructor(
    readonly name = 'div' as N,
    readonly attributes = {} as A,
    readonly children: RenderableTreeNode[] = [],
    readonly location: Location | undefined = undefined,
    readonly lines: number[] | undefined = undefined,
    readonly id = getId()
  ) {}
}
