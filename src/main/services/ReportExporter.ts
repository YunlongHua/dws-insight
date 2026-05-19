import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel } from 'docx';
import { writeFile } from 'fs/promises';
import { getReportById, getTestCases, Report, TestCase } from '../storage/database';

export const reportExporter = {
  async exportToWord(reportId: string, outputPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const report = getReportById(parseInt(reportId, 10));
      if (!report) {
        return { success: false, error: 'Report not found' };
      }

      const testCases = getTestCases(parseInt(reportId, 10));

      // Create a document with proper structure
      const children: (Paragraph | Table)[] = [
        // Title
        new Paragraph({
          text: report.name,
          heading: HeadingLevel.TITLE,
        }),
        // Description
        new Paragraph({
          children: [
            new TextRun({
              text: report.description,
              color: '666666',
            }),
          ],
        }),
        new Paragraph({ text: '' }), // Spacer
      ];

      // Add each test case
      for (const tc of testCases) {
        // Test case name as heading
        children.push(
          new Paragraph({
            text: tc.name,
            heading: HeadingLevel.HEADING_1,
          })
        );

        // Preconditions
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Preconditions: ', bold: true }),
              new TextRun({ text: tc.preconditions }),
            ],
          })
        );

        // Steps table
        let steps: { step: string; expected: string }[] = [];
        try {
          steps = JSON.parse(tc.steps);
        } catch {
          steps = [{ step: tc.steps, expected: '' }];
        }

        if (steps.length > 0) {
          const tableRows: TableRow[] = [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'Step', children: [new TextRun({ bold: true })] })],
                }),
                new TableCell({
                  children: [new Paragraph({ text: 'Expected Result', children: [new TextRun({ bold: true })] })],
                }),
              ],
            }),
          ];

          for (const step of steps) {
            tableRows.push(
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: step.step || '' })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: step.expected || '' })],
                  }),
                ],
              })
            );
          }

          children.push(
            new Table({
              rows: tableRows,
            })
          );
        }

        // Expected results (if not in steps)
        if (tc.expected_results) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Expected Results: ', bold: true }),
                new TextRun({ text: tc.expected_results }),
              ],
            })
          );
        }

        // Status
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Status: ', bold: true }),
              new TextRun({ text: tc.status }),
            ],
          })
        );

        // Notes
        if (tc.notes) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Notes: ', bold: true }),
                new TextRun({ text: tc.notes }),
              ],
            })
          );
        }

        children.push(new Paragraph({ text: '' })); // Spacer between test cases
      }

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: children,
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);
      await writeFile(outputPath, buffer);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async exportToMarkdown(reportId: string, outputPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const report = getReportById(parseInt(reportId, 10));
      if (!report) {
        return { success: false, error: 'Report not found' };
      }

      const testCases = getTestCases(parseInt(reportId, 10));

      let md = `# ${report.name}\n\n`;
      md += `${report.description}\n\n`;
      md += `---\n\n`;

      for (const tc of testCases) {
        md += `## ${tc.name}\n\n`;

        md += `**Preconditions:** ${tc.preconditions}\n\n`;

        // Parse steps
        let steps: { step: string; expected: string }[] = [];
        try {
          steps = JSON.parse(tc.steps);
        } catch {
          steps = [{ step: tc.steps, expected: '' }];
        }

        if (steps.length > 0) {
          md += `| Step | Expected Result |\n`;
          md += `|------|----------------|\n`;
          for (const step of steps) {
            md += `| ${step.step || ''} | ${step.expected || ''} |\n`;
          }
          md += `\n`;
        }

        if (tc.expected_results) {
          md += `**Expected Results:** ${tc.expected_results}\n\n`;
        }

        md += `**Status:** ${tc.status}\n\n`;

        if (tc.notes) {
          md += `**Notes:** ${tc.notes}\n\n`;
        }

        md += `---\n\n`;
      }

      await writeFile(outputPath, md, 'utf-8');

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async exportToPDF(reportId: string, outputPath: string): Promise<{ success: boolean; error?: string }> {
    // PDF export requires a two-step approach: Word -> PDF conversion
    // This would require LibreOffice or similar tool to be installed
    // For now, we export to Word format and note that PDF requires external conversion
    try {
      const wordPath = outputPath.replace(/\.pdf$/i, '.docx');
      const wordResult = await this.exportToWord(reportId, wordPath);

      if (!wordResult.success) {
        return wordResult;
      }

      return {
        success: false,
        error: `PDF export not directly supported. Word document exported to: ${wordPath}. Use LibreOffice or similar tool to convert to PDF.`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
