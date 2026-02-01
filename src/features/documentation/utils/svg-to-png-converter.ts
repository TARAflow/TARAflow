// ==================== SVG TO PNG CONVERTER ====================
// Location: features/documentation/utils/svg-to-png-converter.ts

/**
 * Converts SVG data URL to PNG data URL
 * Uses browser canvas API - no external dependencies needed!
 */
export async function convertSvgToPng(
  svgDataUrl: string,
  options: { width?: number; height?: number; scale?: number } = {}
): Promise<string> {
  const { width = 1200, height = 800, scale = 2 } = options;

  return new Promise((resolve, reject) => {
    // Create image element
    const img = new Image();
    
    img.onload = () => {
      try {
        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Use actual image dimensions or specified dimensions
        const imgWidth = img.width || width;
        const imgHeight = img.height || height;
        
        // Set canvas size with scale for better quality
        canvas.width = imgWidth * scale;
        canvas.height = imgHeight * scale;
        
        // Scale context for high-DPI rendering
        ctx.scale(scale, scale);
        
        // White background (optional, remove for transparent)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, imgWidth, imgHeight);
        
        // Draw SVG image onto canvas
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);
        
        // Convert canvas to PNG data URL
        const pngDataUrl = canvas.toDataURL('image/png', 1.0);
        
        resolve(pngDataUrl);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load SVG image'));
    };
    
    // Load SVG
    img.src = svgDataUrl;
  });
}

/**
 * Converts SVG data URL to PNG for PDF generation
 * Optimized for PDF size (lower quality, smaller file)
 */
export async function convertSvgToPngForPdf(
  svgDataUrl: string
): Promise<string> {
  return convertSvgToPng(svgDataUrl, {
    width: 800,   // Smaller for PDF
    height: 600,
    scale: 1.5,   // Less scale = smaller file
  });
}