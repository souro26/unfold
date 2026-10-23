import { describe, it, expect, vi } from 'vitest';
import { escapeHtml, formatTime, generateId, debounce } from '../src/utils/helpers';

describe('Helper Utilities', () => {
  it('escapeHtml should escape HTML entities properly', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(escapeHtml("Tom & 'Jerry'")).toBe('Tom &amp; &#039;Jerry&#039;');
    expect(escapeHtml('1 < 2 && 4 > 3')).toBe('1 &lt; 2 &amp;&amp; 4 &gt; 3');
  });

  it('formatTime should format timestamp into time string', () => {
    const ts = new Date('2026-10-23T14:30:00Z').getTime();
    const formatted = formatTime(ts);
    expect(formatted).toBeDefined();
    expect(typeof formatted).toBe('string');
  });

  it('generateId should produce unique prefixed IDs', () => {
    const id1 = generateId('conv');
    const id2 = generateId('conv');
    expect(id1).toMatch(/^conv_\d+_[a-z0-9]+$/);
    expect(id2).toMatch(/^conv_\d+_[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });

  it('debounce should delay function execution', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
