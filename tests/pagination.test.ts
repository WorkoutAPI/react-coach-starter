import { expect, it } from 'vitest';
import { paginationSlots } from '../src/components/pagination';

it('keeps the current page and both ends visible with gaps', () => {
  expect(paginationSlots(1, 10)).toEqual([1, 2, 'ellipsis', 10]);
  expect(paginationSlots(5, 10)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]);
  expect(paginationSlots(10, 10)).toEqual([1, 'ellipsis', 9, 10]);
});
