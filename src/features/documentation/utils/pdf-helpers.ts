// ==================== PDF HELPER UTILITIES ====================
// Location: src/features/documentation/utils/pdf-helpers.ts
// Standalone utility functions for PDF generation

import type { DocProjectData, DocConfiguration } from '../models/doc-types';
import { convertSvgToPngForPdf } from './svg-to-png-converter';

/**
 * Creates a copy of the project with DFD thumbnail converted from SVG to PNG.
 * This is necessary because pdfMake cannot handle SVG images.
 * 
 * @param project - Original project data
 * @returns Promise resolving to project with PNG thumbnail, or original if no conversion needed
 * 
 * @example
 * const projectWithPng = await createProjectWithPng(project);
 * const pdfGenerator = new PdfGenerator(projectWithPng);
 */
export async function createProjectWithPng(
  project: DocProjectData
): Promise<DocProjectData> {
  // No DFD or no thumbnail - nothing to convert
  if (!project.dfd?.thumbnail) {
    console.log('No DFD thumbnail to convert');
    return project;
  }

  try {
    console.log('Converting DFD thumbnail from SVG to PNG...');
    const pngDataUrl = await convertSvgToPngForPdf(project.dfd.thumbnail);

    const processedProject: DocProjectData = {
      ...project,
      dfd: {
        ...project.dfd,
        thumbnail: pngDataUrl,
      },
    };

    console.log('DFD thumbnail converted successfully');
    console.log('PNG preview:', pngDataUrl.substring(0, 50) + '...');
    
    return processedProject;
  } catch (error) {
    console.error('DFD thumbnail conversion failed:', error);
    
    // Fallback: Return project without thumbnail
    // Better to have no image than a broken PDF
    const fallbackProject: DocProjectData = {
      ...project,
      dfd: {
        ...project.dfd,
        thumbnail: undefined,
      },
    };
    
    console.warn('Continuing without DFD thumbnail');
    return fallbackProject;
  }
}

/**
 * Creates a PDF Blob from project data using PdfGeneratorAdaptive.
 * 
 * @param project - Project data (should have PNG thumbnail if DFD exists)
 * @param config - Documentation configuration
 * @param tFn - Translation function for i18n
 * @returns Promise resolving to PDF Blob
 * @throws Error if PDF generation fails
 * 
 * @example
 * const tWrapper = (key: string, defaultValue?: string) => t(key, { defaultValue });
 * const blob = await createPdfBlob(project, config, tWrapper);
 * saveAs(blob, 'document.pdf');
 */
export async function createPdfBlob(
  project: DocProjectData,
  config: DocConfiguration,
  tFn: (key: string, defaultValue?: string) => string
): Promise<Blob> {
  try {
    console.log('Generating PDF with pdfMake...');
    
    // Dynamic import to reduce initial bundle size
    const { PdfGeneratorAdaptive } = await import(
      './generators/pdf-generator-adaptive'
    );

    const pdfGenerator = new PdfGeneratorAdaptive(project, config, tFn);
    const pdfResult = await pdfGenerator.generatePdfBuffer();

    console.log('PDF generated successfully');

    // Convert Buffer to Blob if needed (Node.js vs Browser)
    if (pdfResult instanceof Buffer) {
      console.log('Converting Buffer to Blob...');
      return new Blob([new Uint8Array(pdfResult)], {
        type: 'application/pdf',
      });
    }

    return pdfResult;
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw error; // Re-throw to allow caller to handle
  }
}

/**
 * Complete workflow: Convert project to PNG and generate PDF Blob.
 * Convenience function that combines createProjectWithPng and createPdfBlob.
 * 
 * @param project - Original project data
 * @param config - Documentation configuration
 * @param tFn - Translation function
 * @returns Promise resolving to PDF Blob
 * @throws Error if PDF generation fails
 * 
 * @example
 * try {
 *   const blob = await generatePdfFromProject(project, config, t);
 *   downloadBlob(blob, 'document.pdf');
 * } catch (error) {
 *   console.error('PDF generation failed:', error);
 * }
 */
export async function generatePdfFromProject(
  project: DocProjectData,
  config: DocConfiguration,
  tFn: (key: string, defaultValue?: string) => string
): Promise<Blob> {
  // Step 1: Convert SVG to PNG
  const projectWithPng = await createProjectWithPng(project);
  
  // Step 2: Generate PDF
  const blob = await createPdfBlob(projectWithPng, config, tFn);
  
  return blob;
}

/**
 * Helper to trigger browser download of a Blob.
 * 
 * @param blob - Blob to download
 * @param filename - Suggested filename
 * 
 * @example
 * const blob = await generatePdfFromProject(project, config, t);
 * downloadBlob(blob, 'my-document.pdf');
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}