import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../src/utils/markdown';

describe('Markdown Renderer', () => {
  it('should render headers correctly', () => {
    expect(renderMarkdown('# Header 1')).toContain('<h1>Header 1</h1>');
    expect(renderMarkdown('## Header 2')).toContain('<h2>Header 2</h2>');
    expect(renderMarkdown('### Header 3')).toContain('<h3>Header 3</h3>');
  });

  it('should render bold and italic text', () => {
    expect(renderMarkdown('**bold text**')).toContain('<strong>bold text</strong>');
    expect(renderMarkdown('*italic text*')).toContain('<em>italic text</em>');
  });

  it('should render inline code', () => {
    expect(renderMarkdown('Use `const x = 10;` here')).toContain('<code>const x = 10;</code>');
  });

  it('should render fenced code blocks with language and copy button', () => {
    const input = '```typescript\nconst a = 1;\nconsole.log(a);\n```';
    const output = renderMarkdown(input);

    expect(output).toContain('<div class="code-block-wrapper">');
    expect(output).toContain('<span class="code-lang">typescript</span>');
    expect(output).toContain('<button class="copy-code-btn"');
    expect(output).toContain('const a = 1;');
  });

  it('should render KaTeX math expressions', () => {
    const mathInline = 'Formula $E = mc^2$';
    const outputInline = renderMarkdown(mathInline);
    expect(outputInline).toContain('katex');

    const mathBlock = '$$\\int_0^1 x dx$$';
    const outputBlock = renderMarkdown(mathBlock);
    expect(outputBlock).toContain('katex-display');
  });

  it('should handle empty or null string gracefully', () => {
    expect(renderMarkdown('')).toBe('');
  });
});
