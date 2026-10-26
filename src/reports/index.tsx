// Entry point for the PDF reports. Imported with import() when someone downloads a report,
// so the PDF library never loads for people who only browse.

import { pdf } from '@react-pdf/renderer';
import type { ReactElement } from 'react';

import { CampusReport, type CampusReportData } from '@/reports/CampusReport';
import { StudentReport, type StudentReportData } from '@/reports/StudentReport';
import { formatDate, registerFonts, safeFileName } from '@/reports/shared';

export type { CampusReportData, CampusReportRow, ReportValue } from '@/reports/CampusReport';
export type { StudentReportData } from '@/reports/StudentReport';

async function save(document: ReactElement, fileName: string) {
  const blob = await pdf(document as never).toBlob();
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** "Sunstone PRIME Vantage - Coding Report - SAGE University, Indore - Batch 2027 - 16 Oct 2026.pdf" */
export async function downloadCampusReport(data: CampusReportData) {
  registerFonts(data.origin);
  const parts = [
    'Sunstone PRIME Vantage',
    'Coding Report',
    data.title,
    ...data.filters,
    formatDate(data.generatedAt),
  ];
  await save(<CampusReport data={data} />, `${safeFileName(parts.join(' - '))}.pdf`);
}

/** "Sunstone PRIME Vantage - Rakesh Kumar - Coding Report (SAGE University, Indore) - 16 Oct 2026.pdf" */
export async function downloadStudentReport(data: StudentReportData) {
  registerFonts(data.origin);
  const where = data.campus ? ` (${data.campus})` : '';
  const name = `Sunstone PRIME Vantage - ${data.name} - Coding Report${where} - ${formatDate(data.generatedAt)}`;
  await save(<StudentReport data={data} />, `${safeFileName(name)}.pdf`);
}
