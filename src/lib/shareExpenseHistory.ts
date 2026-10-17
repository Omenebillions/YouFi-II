import { jsPDF } from 'jspdf';

export interface ShareableExpense {
  date?: string | null;
  type?: string | null;
  category?: string | null;
  note?: string | null;
  amount: number | string;
  currency?: string;
  frequency?: string | null;
}

function displayValue(value: unknown): string {
  return value == null ? '' : String(value);
}

export async function shareExpenseHistory(
  rows: ShareableExpense[],
  fileName: string,
  title: string,
): Promise<'shared' | 'downloaded'> {
  if (rows.length === 0) {
    throw new Error('There are no records to share.');
  }

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const lineHeight = 4;
  const columns = [
    { title: 'Date', width: 25 },
    { title: 'Type', width: 21 },
    { title: 'Category', width: 38 },
    { title: 'Note', width: 91 },
    { title: 'Amount', width: 32 },
    { title: 'Currency', width: 25 },
    { title: 'Frequency', width: 41 },
  ];
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const tableBottom = pageHeight - margin;
  let y = margin;

  const drawTableHeader = () => {
    pdf.setFillColor(16, 185, 129);
    pdf.rect(margin, y, tableWidth, 8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    let x = margin;
    for (const column of columns) {
      pdf.text(column.title, x + 2, y + 5.5);
      x += column.width;
    }
    y += 8;
  };

  const drawPageHeading = () => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(17, 24, 39);
    pdf.text(title, margin, y + 6);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    pdf.text(`${rows.length} records  |  Generated ${new Date().toLocaleString()}`, margin, y + 12);
    pdf.text('YouFi transaction history', pageWidth - margin, y + 12, { align: 'right' });
    y += 17;
    drawTableHeader();
  };

  drawPageHeading();
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(31, 41, 55);

  for (const row of rows) {
    const values = [
      displayValue(row.date),
      displayValue(row.type),
      displayValue(row.category),
      displayValue(row.note),
      displayValue(row.amount),
      displayValue(row.currency),
      displayValue(row.frequency),
    ];
    const wrapped = values.map((value, index) =>
      pdf.splitTextToSize(value, columns[index].width - 4),
    );
    const rowHeight = Math.max(8, ...wrapped.map(lines => lines.length * lineHeight + 4));

    if (y + rowHeight > tableBottom) {
      pdf.addPage();
      y = margin;
      drawPageHeading();
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(31, 41, 55);
    }

    pdf.setDrawColor(229, 231, 235);
    pdf.setFillColor(249, 250, 251);
    pdf.rect(margin, y, tableWidth, rowHeight, 'FD');
    let x = margin;
    for (let index = 0; index < columns.length; index += 1) {
      pdf.text(wrapped[index], x + 2, y + 5);
      x += columns[index].width;
    }
    y += rowHeight;
  }

  const safeFileName = fileName.toLowerCase().endsWith('.pdf')
    ? fileName
    : `${fileName.replace(/\.[^.]+$/, '')}.pdf`;
  const file = new File([pdf.output('blob')], safeFileName, { type: 'application/pdf' });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title });
    return 'shared';
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
