import { describe, expect, it } from 'vitest';
import { viewFromLocation, viewPaths } from '../src/lib/navigation';

describe('clean workspace paths', () => {
  it('resolves direct paths and old hash links', () => {
    expect(viewFromLocation('/progress')).toBe('progress');
    expect(viewFromLocation('/settings/')).toBe('account');
    expect(viewFromLocation('/', '#progress')).toBe('progress');
    expect(viewPaths.progress).toBe('/progress');
    expect(viewFromLocation('/progress', '#messages')).toBe('progress');
  });
});
