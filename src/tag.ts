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
    public name = 'div' as N,
    public attributes = {} as A,
    public children: RenderableTreeNode[] = [],
    readonly location: Location | undefined = undefined,
    readonly lines: number[] | undefined = undefined,
    readonly id = getId()
  ) {}
}
