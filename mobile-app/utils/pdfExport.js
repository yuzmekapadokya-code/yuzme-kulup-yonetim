import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatTryCurrency(value) {
  const numeric = Number(value || 0);
  return `\u20BA${numeric.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatReportDateTR() {
  const now = new Date();
  const date = now.toLocaleDateString('tr-TR');
  const time = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function buildHtmlDocument(bodyHtml, { orientation = 'portrait' } = {}) {
  return `<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      @page { size: A4 ${orientation}; margin: 12mm; }
      body {
        font-family: 'Helvetica', 'Arial', sans-serif;
        color: #1e293b;
        background: #ffffff;
        font-size: 11px;
        margin: 0;
        padding: 0;
      }
      h1, h2, h3 { margin: 0 0 6px; color: #0f2942; }
      p { margin: 0 0 8px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #0f2942; color: #fff; padding: 7px 5px; text-align: left; }
      td { border: 1px solid #dbe4ef; padding: 6px 5px; vertical-align: middle; }
      tr.row-even td { background: #f8fafc; }
      .money { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
      .badge {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 6px;
        background: #eef2f8;
        color: #0f2942;
        font-size: 10px;
        font-weight: 600;
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        margin-bottom: 14px;
      }
      .summary-card {
        border: 1px solid #dbe4ef;
        border-radius: 8px;
        padding: 8px;
        background: #f8fbff;
        text-align: center;
      }
      .summary-card span { display: block; font-size: 10px; color: #64748b; margin-bottom: 4px; }
      .summary-card strong { font-size: 13px; color: #0b7ea8; }
      .group-block { margin-bottom: 14px; page-break-inside: avoid; }
      .group-title {
        background: #e8f6fc;
        border: 1px solid #b8d9e8;
        border-bottom: none;
        padding: 6px 8px;
        font-size: 11px;
        font-weight: 700;
      }
      .section-title {
        margin: 12px 0 8px;
        font-size: 12px;
        font-weight: 700;
        color: #0f2942;
        border-bottom: 2px solid #e2e8f0;
        padding-bottom: 4px;
      }
      .header { text-align: center; margin-bottom: 12px; }
      .header h1 { font-size: 18px; }
      .header p { color: #64748b; font-size: 11px; }
      .footer-note { margin-top: 10px; font-size: 9px; color: #94a3b8; }
    </style>
  </head>
  <body>
    ${bodyHtml}
  </body>
</html>`;
}

export async function generateAndSharePdf({ html, orientation = 'portrait', fileName = 'rapor.pdf' } = {}) {
  if (!html) {
    throw new Error('PDF icin icerik bulunamadi.');
  }
  const fullHtml = buildHtmlDocument(html, { orientation });
  const printOptions = {
    html: fullHtml,
    width: orientation === 'landscape' ? 842 : 595,
    height: orientation === 'landscape' ? 595 : 842,
    base64: false,
  };
  const result = await Print.printToFileAsync(printOptions);
  if (!result?.uri) {
    throw new Error('PDF olusturulamadi.');
  }

  if (Platform.OS === 'web') {
    const link = document.createElement('a');
    link.href = result.uri;
    link.download = fileName;
    link.click();
    return result.uri;
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, {
      UTI: 'com.adobe.pdf',
      mimeType: 'application/pdf',
      dialogTitle: fileName,
    });
  }
  return result.uri;
}
