export interface ShareableExpense {
  date?: string | null;
  type?: string | null;
  category?: string | null;
  note?: string | null;
  amount: number | string;
  currency?: string;
  frequency?: string | null;
}

function escapeCsv(value: unknown): string {
  const rawText = String(value ?? '');
  const text = typeof value === 'string' && /^[\s]*[=+\-@]/.test(rawText)
    ? `'${rawText}`
    : rawText;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function shareExpenseHistory(
  rows: ShareableExpense[],
  fileName: string,
  title: string,
): Promise<'shared' | 'downloaded'> {
  if (rows.length === 0) {
    throw new Error('There are no records to share.');
  }

  const headers = ['Date', 'Type', 'Category', 'Note', 'Amount', 'Currency', 'Frequency'];
  const csv = [
    headers.map(escapeCsv).join(','),
    ...rows.map(row => [
      row.date,
      row.type,
      row.category,
      row.note,
      row.amount,
      row.currency,
      row.frequency,
    ].map(escapeCsv).join(',')),
  ].join('\r\n');
  const file = new File([`\uFEFF${csv}`], fileName, { type: 'text/csv;charset=utf-8' });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title });
    return 'shared';
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
