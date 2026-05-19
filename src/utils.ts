export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'B';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'M';
  }
  return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/** Escapes user-supplied strings before embedding in HTML to prevent XSS. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
