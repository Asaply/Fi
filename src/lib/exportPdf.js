import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ACCENT = [255, 90, 31]; // NVA orange
const DARK   = [15, 15, 15];
const GRAY   = [100, 100, 100];
const LIGHT  = [245, 245, 245];

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-MX', {
            day: '2-digit', month: 'short', year: 'numeric',
        });
    } catch { return dateStr; }
}

export async function exportDataAsPDF({ transactions = [], clients = [], userEmail = '' }) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const now = new Date();
    const dateLabel = now.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

    /* ── Header bar ── */
    doc.setFillColor(...ACCENT);
    doc.rect(0, 0, pageW, 22, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('NVA Finance', 14, 14);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Reporte de datos personales', pageW - 14, 14, { align: 'right' });

    /* ── Meta info ── */
    doc.setTextColor(...DARK);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    let y = 32;

    doc.text(`Generado el: ${dateLabel}`, 14, y);
    if (userEmail) doc.text(`Cuenta: ${userEmail}`, 14, y + 5);
    y += 14;

    /* ── Summary stats ── */
    const ingresos = transactions.filter(t => t.type === 'Ingreso').reduce((s, t) => s + (t.amount || 0), 0);
    const egresos  = transactions.filter(t => t.type === 'Egreso').reduce((s, t) => s + (t.amount || 0), 0);
    const gastos   = transactions.filter(t => t.type === 'Gasto Personal').reduce((s, t) => s + (t.amount || 0), 0);
    const neto     = ingresos - egresos;

    const stats = [
        { label: 'Total ingresos', value: formatCurrency(ingresos) },
        { label: 'Total egresos',  value: formatCurrency(egresos) },
        { label: 'Gastos personales', value: formatCurrency(gastos) },
        { label: 'Balance neto',   value: formatCurrency(neto) },
    ];

    const boxW = (pageW - 28 - 12) / 4;
    stats.forEach((s, i) => {
        const x = 14 + i * (boxW + 4);
        doc.setFillColor(...LIGHT);
        doc.roundedRect(x, y, boxW, 18, 2, 2, 'F');
        doc.setFontSize(7);
        doc.setTextColor(...GRAY);
        doc.text(s.label, x + boxW / 2, y + 6, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...(neto < 0 && s.label === 'Balance neto' ? [220, 38, 38] : DARK));
        doc.text(s.value, x + boxW / 2, y + 13, { align: 'center' });
        doc.setFont('helvetica', 'normal');
    });
    y += 26;

    /* ── Transactions table ── */
    if (transactions.length > 0) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...DARK);
        doc.text('Transacciones', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 4;

        autoTable(doc, {
            startY: y,
            margin: { left: 14, right: 14 },
            head: [['Fecha', 'Descripción', 'Categoría', 'Tipo', 'Monto']],
            body: transactions.map(t => [
                formatDate(t.date),
                t.description || '-',
                t.category || '-',
                t.type || '-',
                formatCurrency(t.amount),
            ]),
            styles: {
                fontSize: 8,
                cellPadding: 3,
                textColor: DARK,
                overflow: 'linebreak',
            },
            headStyles: {
                fillColor: ACCENT,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 8,
            },
            alternateRowStyles: { fillColor: LIGHT },
            columnStyles: {
                0: { cellWidth: 22 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 28 },
                3: { cellWidth: 24 },
                4: { cellWidth: 28, halign: 'right' },
            },
        });

        y = doc.lastAutoTable.finalY + 10;
    }

    /* ── Clients table ── */
    if (clients && clients.length > 0) {
        // Add new page if little space left
        if (y > 220) { doc.addPage(); y = 20; }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...DARK);
        doc.text('Clientes', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 4;

        autoTable(doc, {
            startY: y,
            margin: { left: 14, right: 14 },
            head: [['Nombre', 'Email', 'Teléfono', 'Estado']],
            body: clients.map(c => [
                c.name || '-',
                c.email || '-',
                c.phone || '-',
                c.status || '-',
            ]),
            styles: { fontSize: 8, cellPadding: 3, textColor: DARK },
            headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
            alternateRowStyles: { fillColor: LIGHT },
        });
    }

    /* ── Footer on each page ── */
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        const pageH = doc.internal.pageSize.getHeight();
        doc.setDrawColor(220, 220, 220);
        doc.line(14, pageH - 14, pageW - 14, pageH - 14);
        doc.setFontSize(7);
        doc.setTextColor(...GRAY);
        doc.text('NVA Finance — Información confidencial', 14, pageH - 8);
        doc.text(`Página ${p} de ${totalPages}`, pageW - 14, pageH - 8, { align: 'right' });
    }

    /* ── Save ── */
    const fileName = `nva_datos_${now.toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
}
