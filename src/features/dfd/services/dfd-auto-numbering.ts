// ==================== DFD AUTO NUMBERING SERVICE ====================
// Single Responsibility: Auto-number IdLabels from top-left to bottom-right

/**
 * Configuration for element type prefixes
 * NOTE: Assets are excluded - they are references, not unique elements
 *       Multiple A-001 labels can reference the same asset
 */
export const ELEMENT_PREFIXES: Record<string, string> = {
  process: 'P-',
  multiprocess: 'MP-',
  dataflow: 'DF-',
  datastorage: 'DS-',
  datastore: 'DS-',
  externalentity: 'EE-',
  // asset: excluded - Assets are references, multiple can have same ID
  interface: 'IF-',
};

/**
 * Element with position information for sorting
 */
interface ElementWithPosition {
  id: string;
  type: string;
  x: number;
  y: number;
  idLabelElement: Element | null;
}

/**
 * Numbering counters per type
 */
interface NumberingCounters {
  [type: string]: number;
}

/**
 * DFDAutoNumbering - Service to auto-number IdLabels in DFD diagrams
 */
export class DFDAutoNumbering {
  private readonly rowTolerance: number;

  /**
   * @param rowTolerance - Y-distance tolerance for elements to be considered in the same row (default: 30px)
   */
  constructor(rowTolerance: number = 30) {
    this.rowTolerance = rowTolerance;
  }

  /**
   * Auto-number all IdLabels in the XML from top-left to bottom-right
   * @param xml - The Draw.io XML string
   * @returns The XML string with updated IdLabels
   */
  public autoNumber(xml: string): string {
    if (!xml || xml.trim() === '') {
      return xml;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');

      // Check for parse errors
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        console.error('XML parse error:', parseError.textContent);
        return xml;
      }

      // Find all elements with their positions and IdLabels
      const elementsWithPositions = this.findElementsWithPositions(doc);
      
      console.log('[AutoNumbering] Found elements:', elementsWithPositions.map(e => ({
        id: e.id,
        type: e.type,
        hasIdLabel: !!e.idLabelElement,
        x: e.x,
        y: e.y
      })));

      // Sort elements: top-left to bottom-right (row-based reading order)
      const sortedElements = this.sortElementsByPosition(elementsWithPositions);

      // Group by type and number
      this.applyNumbering(sortedElements);

      // Serialize back to XML
      const serializer = new XMLSerializer();
      return serializer.serializeToString(doc);
    } catch (error) {
      console.error('Auto-numbering failed:', error);
      return xml;
    }
  }

  /**
   * Find all DFD elements with their positions and associated IdLabels
   */
  private findElementsWithPositions(doc: Document): ElementWithPosition[] {
    const elements: ElementWithPosition[] = [];
    const objects = doc.getElementsByTagName('object');

    // First pass: Build a map of all objects by ID and collect group positions
    const objectMap = new Map<string, Element>();
    const groupPositions = new Map<string, { x: number; y: number }>();
    
    Array.from(objects).forEach((obj) => {
      const id = obj.getAttribute('id');
      if (id) {
        objectMap.set(id, obj);
      }
      
      const mxCell = obj.getElementsByTagName('mxCell')[0];
      if (!mxCell) return;

      const style = mxCell.getAttribute('style') || '';
      if (style.includes('group')) {
        const geometry = mxCell.getElementsByTagName('mxGeometry')[0];
        if (geometry && id) {
          groupPositions.set(id, {
            x: parseFloat(geometry.getAttribute('x') || '0'),
            y: parseFloat(geometry.getAttribute('y') || '0'),
          });
        }
      }
    });

    // Second pass: Find elements and their IdLabels
    Array.from(objects).forEach((obj) => {
      const type = (obj.getAttribute('type') || '').toLowerCase();
      const id = obj.getAttribute('id');
      
      if (!id || !type) return;
      
      // Skip idlabels and unknown types
      if (type === 'idlabel' || !this.isValidElementType(type)) return;

      const mxCell = obj.getElementsByTagName('mxCell')[0];
      if (!mxCell) return;

      const style = mxCell.getAttribute('style') || '';
      if (style.includes('group')) return; // Skip group containers

      // Get position
      const position = this.getElementPosition(mxCell, groupPositions);
      
      // Find associated IdLabel - check multiple strategies
      const idLabel = this.findIdLabelForElement(id, obj, doc, objectMap);

      if (idLabel) {
        console.log(`[AutoNumbering] Found IdLabel for ${type} (${id}):`, 
          idLabel.getAttribute('label') || 'no label attr');
      } else {
        console.log(`[AutoNumbering] No IdLabel found for ${type} (${id})`);
      }

      elements.push({
        id,
        type: this.normalizeType(type),
        x: position.x,
        y: position.y,
        idLabelElement: idLabel,
      });
    });

    return elements;
  }

  /**
   * Check if type is a valid DFD element type for auto-numbering
   * NOTE: Assets are excluded - they are references, not unique elements
   */
  private isValidElementType(type: string): boolean {
    const validTypes = [
      'process',
      'multiprocess',
      'dataflow',
      'datastorage',
      'datastore',
      'externalentity',
      // 'asset' excluded - Assets are references
      'interface',
    ];
    return validTypes.includes(type.toLowerCase());
  }

  /**
   * Normalize type names (e.g., datastorage → datastore)
   */
  private normalizeType(type: string): string {
    const typeMap: Record<string, string> = {
      datastorage: 'datastore',
    };
    return typeMap[type.toLowerCase()] || type.toLowerCase();
  }

  /**
   * Get absolute position of an element
   */
  private getElementPosition(
    mxCell: Element,
    groupPositions: Map<string, { x: number; y: number }>
  ): { x: number; y: number } {
    const geometry = mxCell.getElementsByTagName('mxGeometry')[0];
    
    let x = 0;
    let y = 0;

    if (geometry) {
      x = parseFloat(geometry.getAttribute('x') || '0');
      y = parseFloat(geometry.getAttribute('y') || '0');
    }

    // Add parent group position if element is in a group
    const parent = mxCell.getAttribute('parent');
    if (parent && groupPositions.has(parent)) {
      const groupPos = groupPositions.get(parent)!;
      x += groupPos.x;
      y += groupPos.y;
    }

    return { x, y };
  }

  /**
   * Find the IdLabel element associated with an element
   * Tries multiple strategies
   */
  private findIdLabelForElement(
    elementId: string, 
    elementObj: Element,
    doc: Document,
    objectMap: Map<string, Element>
  ): Element | null {
    const objects = doc.getElementsByTagName('object');

    // Strategy 1: IdLabel with parent = elementId (new structure after stencil fix)
    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      const type = (obj.getAttribute('type') || '').toLowerCase();

      if (type === 'idlabel') {
        const mxCell = obj.getElementsByTagName('mxCell')[0];
        const parent = mxCell?.getAttribute('parent');

        if (parent === elementId) {
          return obj;
        }
      }
    }

    // Strategy 2: IdLabel in same group as element
    const elementMxCell = elementObj.getElementsByTagName('mxCell')[0];
    const elementParent = elementMxCell?.getAttribute('parent');
    
    if (elementParent && elementParent !== '1' && elementParent !== '0') {
      // Element is in a group, look for IdLabel in same group
      for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        const type = (obj.getAttribute('type') || '').toLowerCase();

        if (type === 'idlabel') {
          const mxCell = obj.getElementsByTagName('mxCell')[0];
          const parent = mxCell?.getAttribute('parent');

          if (parent === elementParent) {
            return obj;
          }
        }
      }
    }

    // Strategy 3: Look for object without type but with idlabel-like content in same group
    if (elementParent && elementParent !== '1' && elementParent !== '0') {
      for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        const type = obj.getAttribute('type');
        const label = obj.getAttribute('label') || '';
        
        // Object without type attribute but with label that looks like IdLabel
        if (!type && this.looksLikeIdLabel(label)) {
          const mxCell = obj.getElementsByTagName('mxCell')[0];
          const parent = mxCell?.getAttribute('parent');

          if (parent === elementParent || parent === elementId) {
            return obj;
          }
        }
      }
    }

    return null;
  }

  /**
   * Check if a value looks like an IdLabel (e.g., "P-xx", "DF-1", etc.)
   */
  private looksLikeIdLabel(value: string): boolean {
    // Strip HTML tags for check
    const cleanValue = value.replace(/<[^>]*>/g, '').trim();
    
    // More flexible patterns that match various formats
    const patterns = [
      /^P-\d*x*$/i,
      /^MP-\d*x*$/i,
      /^DF-\d*x*$/i,
      /^DS-\d*x*$/i,
      /^EE-\d*x*$/i,
      /^A-\d*x*$/i,
      /^IF-\d*x*$/i,
    ];
    return patterns.some(p => p.test(cleanValue));
  }

  /**
   * Sort elements by position: top-left to bottom-right (reading order)
   */
  private sortElementsByPosition(elements: ElementWithPosition[]): ElementWithPosition[] {
    return [...elements].sort((a, b) => {
      // First, check if elements are in the same "row" (within tolerance)
      const yDiff = a.y - b.y;
      
      if (Math.abs(yDiff) <= this.rowTolerance) {
        // Same row - sort by X (left to right)
        return a.x - b.x;
      }
      
      // Different rows - sort by Y (top to bottom)
      return yDiff;
    });
  }

  /**
   * Apply numbering to elements grouped by type
   */
  private applyNumbering(elements: ElementWithPosition[]): void {
    // Initialize counters for each type
    const counters: NumberingCounters = {};

    elements.forEach((element) => {
      if (!element.idLabelElement) return;

      const type = element.type;
      const prefix = this.getPrefixForType(type);
      
      if (!prefix) return;

      // Initialize counter for type if needed
      if (counters[type] === undefined) {
        counters[type] = 1;
      }

      // Generate new label
      const newLabel = `${prefix}${counters[type]}`;
      counters[type]++;

      // Update the IdLabel
      this.updateIdLabel(element.idLabelElement, newLabel, prefix);
      
      console.log(`[AutoNumbering] Updated ${element.type} (${element.id}) to ${newLabel}`);
    });
  }

  /**
   * Get prefix for element type
   */
  private getPrefixForType(type: string): string | null {
    return ELEMENT_PREFIXES[type.toLowerCase()] || null;
  }

  /**
   * Update an IdLabel element with a new label value
   */
  private updateIdLabel(idLabelElement: Element, newLabel: string, prefix: string): void {
    // Handle <object> element
    if (idLabelElement.tagName === 'object') {
      const currentLabel = idLabelElement.getAttribute('label') || '';
      
      // Replace the label content
      const newLabelWithFormat = this.replaceIdLabelContent(currentLabel, newLabel, prefix);
      idLabelElement.setAttribute('label', newLabelWithFormat);
      
      console.log(`[AutoNumbering] Object label: "${currentLabel}" -> "${newLabelWithFormat}"`);
    }
  }

  /**
   * Replace IdLabel content while preserving HTML formatting
   * Handles various formats:
   * - Plain: "P-xx" -> "P-1"
   * - HTML: "<font style="font-size: 10px">P-xx</font>" -> "<font style="font-size: 10px">P-1</font>"
   * - Span: "<span style="font-size: 10px">EE-xx</span>" -> "<span style="font-size: 10px">EE-1</span>"
   */
  private replaceIdLabelContent(currentLabel: string, newLabel: string, prefix: string): string {
    // If no HTML, just return new label
    if (!currentLabel.includes('<')) {
      return newLabel;
    }

    // Build regex to find the old label pattern
    // Escape the prefix for regex (e.g., "MP-" needs to escape the "-")
    const escapedPrefix = prefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    
    // Pattern matches: prefix followed by digits and/or x's
    // e.g., "P-xx", "P-1", "MP-xx", "EE-123", "A-xx"
    const labelPattern = new RegExp(`${escapedPrefix}[\\dxX]+`, 'i');
    
    // Check if the pattern exists in the label
    if (labelPattern.test(currentLabel)) {
      // Replace the matched pattern with the new label
      const result = currentLabel.replace(labelPattern, newLabel);
      console.log(`[AutoNumbering] Regex replace: "${currentLabel}" -> "${result}"`);
      return result;
    }

    // Fallback: Try to find any IdLabel-like pattern and replace
    const anyLabelPattern = /([PMDS]P?-|DF-|EE-|A-|IF-)[\dxX]+/i;
    if (anyLabelPattern.test(currentLabel)) {
      const result = currentLabel.replace(anyLabelPattern, newLabel);
      console.log(`[AutoNumbering] Fallback replace: "${currentLabel}" -> "${result}"`);
      return result;
    }

    // Last resort: Extract text between tags and replace entirely
    const tagMatch = currentLabel.match(/^(<[^>]+>)(.*?)(<\/[^>]+>)$/);
    if (tagMatch) {
      const result = `${tagMatch[1]}${newLabel}${tagMatch[3]}`;
      console.log(`[AutoNumbering] Tag replace: "${currentLabel}" -> "${result}"`);
      return result;
    }

    // If all else fails, just return the new label
    console.log(`[AutoNumbering] No match, using plain: "${newLabel}"`);
    return newLabel;
  }

  /**
   * Get statistics about what would be numbered
   */
  public getNumberingPreview(xml: string): Record<string, number> {
    if (!xml || xml.trim() === '') {
      return {};
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');

      const elements = this.findElementsWithPositions(doc);
      const counts: Record<string, number> = {};

      elements.forEach((el) => {
        if (el.idLabelElement) {
          const type = el.type;
          counts[type] = (counts[type] || 0) + 1;
        }
      });

      return counts;
    } catch {
      return {};
    }
  }
}

// Export singleton instance
export const dfdAutoNumbering = new DFDAutoNumbering();

export default DFDAutoNumbering;