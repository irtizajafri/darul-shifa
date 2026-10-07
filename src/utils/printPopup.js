import toast from 'react-hot-toast';

// Print a piece of the current page from a throwaway popup window.
//
// Why not window.print() on the main window: on Windows the browser's print
// dialog is MODAL to the window that called it and can open behind it, which
// freezes the whole app (every open tab) until someone finds and dismisses
// the dialog. The OPD slips and certificates already print from a popup
// (see dischargeCertificatePrintUtils.jsx); this helper gives the DOM-based
// report pages the same behaviour without each page rebuilding its markup.
//
// How: clone the element, copy every stylesheet the app has loaded (so the
// page's own SCSS, including its `@media print` rules, still applies), add a
// per-print `@page` rule LAST so it beats the other pages' `@page` rules that
// share the bundle, and let the popup print itself on load.

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function collectStyleTags() {
  // Vite dev injects <style> tags; a production build ships <link> tags whose
  // relative hrefs must be made absolute because the popup starts at about:blank.
  return Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => {
      if (node.tagName === 'LINK') {
        const href = node.getAttribute('href');
        if (!href) return '';
        return `<link rel="stylesheet" href="${escapeHtml(new URL(href, document.baseURI).href)}">`;
      }
      return `<style>${node.textContent}</style>`;
    })
    .join('\n');
}

/**
 * @param {HTMLElement} element  The DOM node to print (use a ref — with the
 *        tab system every open tab stays mounted, so document.querySelector
 *        could pick up another tab's hidden copy).
 * @param {object} [opts]
 * @param {string} [opts.title]           Popup/document title.
 * @param {string} [opts.page='A4 portrait']  `@page size` value.
 * @param {string} [opts.margin='10mm']   `@page margin` value.
 * @param {string} [opts.extraCss]        Extra CSS appended last.
 * @param {boolean} [opts.autoClose=true] Close the popup after printing/cancel.
 * @returns {boolean} false if there was nothing to print or the popup was blocked.
 */
export function printElementInPopup(element, opts = {}) {
  const {
    title = document.title,
    page = 'A4 portrait',
    margin = '10mm',
    extraCss = '',
    autoClose = true,
    windowFeatures = 'width=1000,height=800',
  } = opts;

  if (!element) {
    toast.error('Nothing to print');
    return false;
  }
  const w = window.open('', '_blank', windowFeatures);
  if (!w) {
    toast.error('Popup blocked — please allow popups for this site');
    return false;
  }

  const clone = element.cloneNode(true);
  clone.setAttribute('data-print-root', '');
  // cloneNode copies <img> tags but relative src would break on about:blank;
  // the .src property is already absolute.
  clone.querySelectorAll('img').forEach((img) => { img.setAttribute('src', img.src); });
  // Canvas pixels (charts) are not cloned — snapshot them into images.
  const srcCanvases = element.querySelectorAll('canvas');
  const dstCanvases = clone.querySelectorAll('canvas');
  srcCanvases.forEach((c, i) => {
    try {
      const img = document.createElement('img');
      img.src = c.toDataURL();
      img.width = c.width;
      img.height = c.height;
      dstCanvases[i]?.replaceWith(img);
    } catch {
      /* tainted canvas — leave blank */
    }
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
${collectStyleTags()}
<style>
  /* Popup-only overrides. The cloned element is now the whole document, so
     anything the page's print CSS hid or positioned relative to the app
     shell is reset here; this block is last so it wins. */
  @page { size: ${page}; margin: ${margin}; }
  html, body { background: #fff !important; margin: 0; padding: 0; height: auto !important; min-height: 0 !important; overflow: visible !important; }
  [data-print-root] {
    display: block !important; visibility: visible !important; position: static !important;
    width: auto !important; height: auto !important; min-height: 0 !important; max-height: none !important;
    overflow: visible !important; margin: 0 !important; box-shadow: none !important;
  }
  [data-print-root] * { visibility: visible !important; }
  .no-print { display: none !important; }
  ${extraCss}
</style>
</head>
<body>
${clone.outerHTML}
<script>
  window.onload = function () { setTimeout(function () { window.focus(); window.print(); }, 150); };
  ${autoClose ? 'window.onafterprint = function () { setTimeout(function () { window.close(); }, 100); };' : ''}
</script>
</body>
</html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
