import { escapeHtml } from './helpers';
import katex from 'katex';

export function renderMarkdown(content: string): string {
  if (!content) return '';

  // 0. Extract reasoning / thinking blocks (<reasoning>...</reasoning> or <thought>...</thought>)
  const reasoningBlocks: string[] = [];
  let processed = content.replace(/<(?:reasoning|thought)>([\s\S]*?)<\/(?:reasoning|thought)>/gi, (_, inner) => {
    const renderedInner = renderMarkdownInner(inner.trim());
    reasoningBlocks.push(`
      <details class="reasoning-block" open>
        <summary class="reasoning-summary">
          <div class="reasoning-summary-left">
            <span class="reasoning-icon">🧠</span>
            <span class="reasoning-title">Deep Reasoning & Visual Blueprint</span>
          </div>
          <span class="reasoning-badge">Pedagogical · Spatial Layout · Math</span>
        </summary>
        <div class="reasoning-content">
          ${renderedInner}
        </div>
      </details>
    `);
    return `###REASONING_BLOCK_${reasoningBlocks.length - 1}###`;
  });

  return renderMarkdownInner(processed, reasoningBlocks);
}

function renderMarkdownInner(content: string, reasoningBlocks: string[] = []): string {
  if (!content) return '';

  // 1. Process fenced code blocks first so inner content is not modified
  const codeBlocks: string[] = [];
  let processed = content.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const safeLang = escapeHtml(lang || 'text');
    const safeCode = escapeHtml(code.trim());

    let blueprintSummary = '';
    if ((lang === 'json' || !lang) && code.includes('"steps"')) {
      try {
        const parsed = JSON.parse(code.trim());
        const steps = Array.isArray(parsed) ? parsed : (parsed.steps || []);
        if (steps.length > 0) {
          let totalElements = 0;
          steps.forEach((s: any) => { if (s.elements) totalElements += s.elements.length; });
          blueprintSummary = `
            <div class="blueprint-summary-banner">
              <div class="blueprint-banner-left">
                <span class="blueprint-banner-icon">📐</span>
                <span class="blueprint-banner-title">Blackboard Blueprint Architecture</span>
              </div>
              <span class="blueprint-banner-stats">${steps.length} Steps · ${totalElements} Canvas Elements</span>
            </div>
          `;
        }
      } catch {}
    }

    codeBlocks.push(`
      ${blueprintSummary}
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

  // 10. Restore reasoning blocks
  processed = processed.replace(/###REASONING_BLOCK_(\d+)###/g, (_, index) => {
    return reasoningBlocks[parseInt(index, 10)] || '';
  });

  return processed;
}
