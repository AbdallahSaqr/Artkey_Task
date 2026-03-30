import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportToCSV(data: any[], filename: string) {
  if (!data?.length) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const val = row[header] ?? '';
        return `"${val.toString().replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToPDF(data: any[], filename: string) {
  if (!data?.length) return;

  const doc = new jsPDF();
  
  // Design elements
  doc.setFontSize(18);
  doc.text('Assignments Delivery Report', 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
  doc.text(`Total Records: ${data.length}`, 14, 35);

  const tableHeaders = [['Title', 'Assignee', 'Priority', 'Status', 'Due Date']];
  const tableRows = data.map(row => [
    row.title || 'Untitled',
    row.assignee || 'Unassigned',
    row.priority || 'Medium',
    row.status || 'Pending',
    new Date(row.due_date).toLocaleDateString('en-GB') || 'N/A'
  ]);

  autoTable(doc, {
    head: tableHeaders,
    body: tableRows,
    startY: 45,
    theme: 'grid',
    headStyles: { 
      fillColor: [59, 130, 246], // Tailwind Blue-500 equivalent
      textColor: [255, 255, 255], 
      fontSize: 10,
      fontStyle: 'bold'
    },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { top: 45 }
  });

  doc.save(`${filename}.pdf`);
}
