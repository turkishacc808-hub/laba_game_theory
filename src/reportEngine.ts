import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Matrix } from "./math/gameTheory";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export async function generateGameTheoryReport(
  matrix: Matrix,
  saddleResult: any,
  domResult: any,
  mixedResult: any,
  brResult: any,
  exactPrice: number,
  chartBase64?: string
) {
  const doc = new jsPDF();

  try {
    // Dynamically load Roboto to support Russian Cyrillic characters
    const fontUrl = "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5WZLCzYlKw.ttf"; // Roboto-Regular from Google Fonts Cdn
    const fontRes = await fetch(fontUrl);
    if (!fontRes.ok) throw new Error("Failed to load font");
    const fontData = await fontRes.arrayBuffer();
    const base64Font = arrayBufferToBase64(fontData);

    doc.addFileToVFS('Roboto-Regular.ttf', base64Font);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.setFont('Roboto');
  } catch (e) {
    console.error("Could not load Cyrillic Font, fallback to default", e);
  }

  // --- Title Page & Meta ---
  doc.setFontSize(22);
  doc.text("Анализ Задачи Теории Игр", 14, 22);
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text("Распределение облачных ресурсов (Вариант 17)", 14, 30);
  
  // --- Section 1: Initial Matrix ---
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text("1. Исходная платежная матрица", 14, 45);

  const mHead = [["", ...matrix[0].map((_, j) => `B${j + 1}`)]];
  const mBody = matrix.map((row, i) => [`A${i + 1}`, ...row]);

  autoTable(doc, {
    startY: 50,
    head: mHead,
    body: mBody,
    styles: { font: 'Roboto', fontSize: 10, halign: 'center' },
    headStyles: { fillColor: [0, 88, 188], fontStyle: 'normal' },
    margin: { left: 14 }
  });

  // --- Section 2: Saddle Point ---
  let finalY = (doc as any).lastAutoTable.finalY || 50;
  
  doc.setFontSize(16);
  doc.text("2. Поиск седловой точки", 14, finalY + 15);
  finalY += 15;
  
  doc.setFontSize(12);
  doc.text(`Нижняя цена (Максимин): ${saddleResult.maximin}`, 14, finalY + 8);
  doc.text(`Верхняя цена (Минимакс): ${saddleResult.minimax}`, 14, finalY + 16);
  doc.text(
    saddleResult.hasSaddlePoint 
      ? `Найдена седловая точка. Решение в чистых стратегиях: ${saddleResult.maximin}` 
      : "Седловой точки нет. Решение в смешанных стратегиях.", 
    14, finalY + 24
  );
  
  finalY += 35;

  // --- Section 3: Dominance ---
  doc.setFontSize(16);
  doc.text("3. Редукция матрицы (Доминирование)", 14, finalY);
  
  let msgY = finalY + 8;
  doc.setFontSize(10);
  doc.setTextColor(80);
  if (domResult.eliminated.length === 0) {
    doc.text("Доминируемых стратегий не найдено.", 14, msgY);
    msgY += 8;
  } else {
    domResult.eliminated.forEach((msg: string) => {
      const translated = msg
        .replace('Row', 'Строка')
        .replace('Column', 'Столбец')
        .replace('eliminated', 'исключена')
        .replace('dominated by', 'доминируется');
      doc.text("• " + translated, 14, msgY);
      msgY += 6;
    });
  }

  doc.setTextColor(0);
  const redHead = [["", ...domResult.colLabels.map((j: number) => `B${j + 1}`)]];
  const redBody = domResult.reducedMatrix.map((row: any[], i: number) => [`A${domResult.rowLabels[i] + 1}`, ...row]);

  autoTable(doc, {
    startY: msgY + 5,
    head: redHead,
    body: redBody,
    styles: { font: 'Roboto', fontSize: 10, halign: 'center' },
    headStyles: { fillColor: [16, 185, 129], fontStyle: 'normal' } // emerald-500
  });

  // --- Section 4: Chart ---
  finalY = (doc as any).lastAutoTable.finalY + 15;
  
  // Calculate total required space for Graph + text below
  const neededSpace = (chartBase64 ? 120 : 0) + (mixedResult ? 30 : 0);
  
  // Ensure we don't overflow the A4 page (roughly 297mm max height)
  if (finalY + neededSpace > 280) {
    doc.addPage();
    finalY = 20;
  }
  
  if (chartBase64) {
    doc.setFontSize(16);
    doc.text("4. Графоаналитический метод", 14, finalY);
    
    // Add image. Assuming base64 png
    // Parameters: image, format, x, y, width, height
    doc.addImage(chartBase64, 'PNG', 14, finalY + 10, 180, 90);
    finalY += 110;
  }
  
  if (mixedResult) {
    doc.setFontSize(12);
    doc.text(`Оптимальное p(A1): ${mixedResult.p.toFixed(3)}`, 14, finalY);
    doc.text(`Оптимальное q(B1): ${mixedResult.q.toFixed(3)}`, 14, finalY + 8);
    doc.text(`Точная цена игры (v): ${mixedResult.v.toFixed(3)}`, 14, finalY + 16);
    finalY += 24;
  }

  // --- Section 5: Brown Robinson History (1000 items!) ---
  doc.addPage();
  doc.setFontSize(16);
  doc.text("5. Метод Брауна-Робинсона (Итерационное Приближение)", 14, 20);
  
  doc.setFontSize(12);
  doc.text(`Финальное приближение v: ${brResult.vApprox.toFixed(3)}`, 14, 28);
  doc.text(`Абсолютная погрешность: ${Math.abs(exactPrice - brResult.vApprox).toFixed(4)}`, 14, 36);

  doc.setFontSize(10); // Уменьшен шрифт для широкой таблицы
  const historyHead = [[
    "N", 
    "Выбор A", 
    "Выбор B", 
    "x (Накопл. A)", 
    "y (Накопл. B)", 
    "v_min", 
    "v_max", 
    "v_avg"
  ]];
  
  const historyBody = brResult.history.map((h: any) => [
    h.iter.toString(), 
    `A${h.aChoice + 1}`,
    `B${h.bChoice + 1}`,
    `[${h.cumulativeA.map((n: number) => n.toFixed(1)).join(", ")}]`,
    `[${h.cumulativeB.map((n: number) => n.toFixed(1)).join(", ")}]`,
    h.vMin.toFixed(2), 
    h.vMax.toFixed(2), 
    h.vAvg.toFixed(3)
  ]);

  // The engine magic: this handles thousands of rows, breaking automatically!
  autoTable(doc, {
    startY: 45,
    head: historyHead,
    body: historyBody,
    styles: { font: 'Roboto', fontSize: 8, halign: 'center', cellPadding: 2 },
    headStyles: { fillColor: [245, 158, 11], fontStyle: 'normal' }, // amber-500
    theme: 'grid'
  });

  // Save the document
  doc.save("game_theory_report.pdf");
}
