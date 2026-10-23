import { escapeHtml } from './helpers';
import katex from 'katex';

export function renderMarkdown(content: string): string {
  if (!content) return '';

  // 1. Process fenced code blocks first so inner content is not modified
  const codeBlocks: string[] = [];
  let processed = content.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const safeLang = escapeHtml(lang || 'text');
    const safeCode = escapeHtml(code.trim());
    codeBlocks.push(`
      <div class="code-block-wrapper">
        <div class="code-block-header">
          <span class="code-lang">${safeLang}</span>
          <button class="copy-code-btn" data-code="${escapeHtml(code.trim())}">Copy</button>
        </div>
        <pre><code class="language-${safeLang}">${safeCode}</code></pre>
      </div>
    `);
    return `###CODE_BLOCK_${codeBlocks.length - 1}###`;
  });

  // 2. Process display math $$...$$ and inline math $...$
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `<div class="math-block">$$${escapeHtml(math.trim())}$$</div>`;
    }
  });

  processed = processed.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `<span class="math-inline">$${escapeHtml(math.trim())}$</span>`;
    }
  });

  // 3. Headers
  processed = processed.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  processed = processed.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  processed = processed.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // 4. Bold and Italic
  processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // 5. Inline code
  processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 6. Blockquotes
  processed = processed.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

  // 7. Unordered list items
  processed = processed.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
  processed = processed.replace(/(<li>[\s\S]*?<\/li>)/gim, '<ul>$1</ul>');
  // Clean up duplicate nested <ul>
  processed = processed.replace(/<\/ul>\s*<ul>/g, '');

  // 8. Line breaks (preserve paragraphs)
  processed = processed.replace(/\n\n/g, '<br/><br/>');

  // 9. Restore code blocks
  processed = processed.replace(/###CODE_BLOCK_(\d+)###/g, (_, index) => {
    return codeBlocks[parseInt(index, 10)] || '';
  });

  return processed;
}
