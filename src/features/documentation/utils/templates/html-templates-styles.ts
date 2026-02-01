// ==================== HTML TEMPLATES STYLES ====================
// Centralized CSS styles for HTML document generation
// Location: features/documentation/utils/templates/html-templates-styles.ts

export const CSS_STYLES = `
:root {
  --color-primary: #1e40af;
  --color-secondary: #64748b;
  --color-success: #16a34a;
  --color-warning: #ca8a04;
  --color-danger: #dc2626;
  --color-bg: #ffffff;
  --color-bg-alt: #f8fafc;
  --color-border: #e2e8f0;
  --color-text: #1e293b;
  --color-text-muted: #64748b;
}

* {
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text);
  background: var(--color-bg);
  margin: 0;
  padding: 0;
}

.container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 40px;
}

/* Typography */
h1 { font-size: 2.5em; margin: 0 0 0.5em; color: var(--color-primary); }
h2 { font-size: 1.75em; margin: 2em 0 0.75em; padding-bottom: 0.3em; border-bottom: 2px solid var(--color-border); }
h3 { font-size: 1.35em; margin: 1.5em 0 0.5em; color: var(--color-secondary); }
h4 { font-size: 1.1em; margin: 1.25em 0 0.5em; }
p { margin: 0.75em 0; }

/* Header */
.doc-header {
  margin-bottom: 2em;
  padding-bottom: 1.5em;
  border-bottom: 3px solid var(--color-primary);
}

.doc-subtitle {
  font-size: 1.2em;
  color: var(--color-secondary);
  margin: 0.5em 0 1em;
}

.classification-badge {
  display: inline-block;
  padding: 0.25em 0.75em;
  border-radius: 4px;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.85em;
  margin-bottom: 1em;
}

.classification-public { background: #dcfce7; color: #166534; }
.classification-internal { background: #dbeafe; color: #1e40af; }
.classification-confidential { background: #fef3c7; color: #92400e; }
.classification-restricted { background: #fee2e2; color: #991b1b; }

/* Metadata table */
.metadata-table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
  font-size: 0.95em;
}

.metadata-table th,
.metadata-table td {
  padding: 0.6em 1em;
  text-align: left;
  border: 1px solid var(--color-border);
}

.metadata-table th {
  background: var(--color-bg-alt);
  font-weight: 600;
  width: 180px;
}

/* Tags */
.tag-group {
  margin: 0.5em 0;
}

.tag-label {
  font-weight: 600;
  color: var(--color-secondary);
  margin-right: 0.5em;
}

.tag {
  display: inline-block;
  padding: 0.2em 0.6em;
  margin: 0.2em;
  border-radius: 3px;
  font-size: 0.85em;
  font-weight: 500;
}

.tag-domain { background: #dbeafe; color: #1e40af; }
.tag-platform { background: #fce7f3; color: #9f1239; }
.tag-regulation { background: #fef3c7; color: #92400e; }
.tag-other { background: #f1f5f9; color: #475569; }

/* TOC */
.toc {
  background: var(--color-bg-alt);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 1.5em;
  margin: 2em 0;
}

.toc h2 {
  margin-top: 0;
  border: none;
  padding: 0;
}

.toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.toc-list li {
  padding: 0.4em 0;
  border-bottom: 1px solid var(--color-border);
}

.toc-list li:last-child {
  border-bottom: none;
}

.toc-list a {
  color: var(--color-primary);
  text-decoration: none;
  display: block;
}

.toc-list a:hover {
  text-decoration: underline;
}

/* Sections */
.chapter {
  margin: 3em 0;
}

/* Tables */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5em 0;
  font-size: 0.95em;
}

table th {
  background: var(--color-bg-alt);
  border: 1px solid var(--color-border);
  padding: 0.75em 1em;
  text-align: left;
  font-weight: 600;
  color: var(--color-secondary);
}

table td {
  border: 1px solid var(--color-border);
  padding: 0.6em 1em;
  vertical-align: top;
}

table tbody tr:nth-child(even) {
  background: var(--color-bg-alt);
}

table tbody tr:hover {
  background: #e0f2fe;
}

/* Badges */
.badge {
  display: inline-block;
  padding: 0.2em 0.5em;
  border-radius: 3px;
  font-size: 0.85em;
  font-weight: 600;
}

.badge-low { background: #dcfce7; color: #166534; }
.badge-medium { background: #fef3c7; color: #92400e; }
.badge-high { background: #fed7aa; color: #9a3412; }
.badge-critical { background: #fee2e2; color: #991b1b; }

.badge-must { background: #fee2e2; color: #991b1b; }
.badge-should { background: #fed7aa; color: #9a3412; }
.badge-could { background: #fef3c7; color: #92400e; }
.badge-wont { background: #f1f5f9; color: #475569; }

.badge-not-started { background: #f1f5f9; color: #475569; }
.badge-in-progress { background: #dbeafe; color: #1e40af; }
.badge-done { background: #dcfce7; color: #166534; }

/* Element cards */
.element-card {
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 1.5em;
  margin: 1em 0;
}

.element-card h4 {
  margin-top: 0;
  color: var(--color-primary);
}

.element-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1em;
}

.property-grid {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 0.5em 1em;
  margin: 1em 0;
}

.property-label {
  font-weight: 600;
  color: var(--color-secondary);
}

.property-value {
  color: var(--color-text);
}

/* Lists */
ul, ol {
  margin: 0.75em 0;
  padding-left: 2em;
}

li {
  margin: 0.3em 0;
}

/* Footer */
.doc-footer {
  margin-top: 4em;
  padding-top: 2em;
  border-top: 2px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: 0.9em;
  text-align: center;
}

/* Print styles */
@media print {
  body { font-size: 11pt; }
  .container { max-width: none; padding: 0; }
  h2 { page-break-after: avoid; }
  table { page-break-inside: avoid; }
  .element-card { page-break-inside: avoid; }
}

/* ==================== EXTENDED STYLES ==================== */

/* Element Detail Sections */
.element-detail,
.connection-detail {
  margin: 2em 0;
  padding: 1.5em;
  background: var(--color-bg-alt);
  border-left: 4px solid var(--color-primary);
  border-radius: 4px;
}

.element-detail h4,
.connection-detail h4 {
  margin-top: 0;
  color: var(--color-primary);
}

/* Property Groups */
.property-group {
  margin: 1em 0;
}

.property-group-title {
  font-size: 1em;
  font-weight: 600;
  color: var(--color-secondary);
  margin: 0.75em 0 0.5em;
  padding-bottom: 0.25em;
  border-bottom: 1px solid var(--color-border);
}

.property-list {
  list-style: none;
  padding: 0;
  margin: 0.5em 0;
}

.property-list li {
  padding: 0.4em 0;
  border-bottom: 1px dotted var(--color-border);
}

.property-list li:last-child {
  border-bottom: none;
}

.property-list strong {
  color: var(--color-text);
  font-weight: 600;
  min-width: 200px;
  display: inline-block;
}

/* Asset Relations */
.asset-relations {
  margin: 1em 0;
  padding: 0.75em;
  background: #fef3c7;
  border-left: 3px solid #f59e0b;
  border-radius: 3px;
  font-size: 0.95em;
}

.connection-label {
  font-style: italic;
  color: var(--color-text-muted);
  margin: 0.5em 0;
}

/* Asset Section */
.asset-section {
  margin: 2em 0;
  padding: 1.5em;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.asset-section h3 {
  margin-top: 0;
  color: var(--color-primary);
  border-bottom: 2px solid var(--color-border);
  padding-bottom: 0.5em;
}

.asset-description {
  color: var(--color-text-muted);
  font-style: italic;
  margin: 0.75em 0;
}

.section-label {
  font-weight: 600;
  margin: 1em 0 0.5em;
  color: var(--color-secondary);
}

/* Element Relations List */
.element-relations {
  list-style: none;
  padding: 0;
  margin: 0;
}

.element-relations > li {
  margin: 1em 0;
  padding: 1em;
  background: var(--color-bg-alt);
  border-left: 3px solid var(--color-success);
  border-radius: 4px;
}

.element-relations > li strong {
  color: var(--color-primary);
}

.element-relations ul {
  margin: 0.5em 0 0 0;
  padding-left: 1.5em;
  list-style: none;
}

.element-relations ul li {
  padding: 0.25em 0;
  color: var(--color-text-muted);
  font-size: 0.95em;
}

.element-relations ul li::before {
  content: "→ ";
  color: var(--color-secondary);
  font-weight: bold;
}

/* No Content Message */
.no-content {
  padding: 2em;
  text-align: center;
  color: var(--color-text-muted);
  background: var(--color-bg-alt);
  border-radius: 4px;
  font-style: italic;
}

/* Data Table (for overview) */
.data-table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5em 0;
  font-size: 0.95em;
}

.data-table thead {
  background: var(--color-primary);
  color: white;
}

.data-table th {
  padding: 0.75em 1em;
  text-align: left;
  font-weight: 600;
}

.data-table tbody tr:nth-child(even) {
  background: var(--color-bg-alt);
}

.data-table tbody tr:hover {
  background: #e0f2fe;
}

.data-table td {
  padding: 0.75em 1em;
  border-bottom: 1px solid var(--color-border);
  vertical-align: top;
}

.data-table td:first-child {
  font-weight: 600;
  color: var(--color-primary);
  white-space: nowrap;
}

/* Print Styles for Extended Elements */
@media print {
  .element-detail,
  .connection-detail,
  .asset-section {
    page-break-inside: avoid;
    box-shadow: none;
  }
  
  .property-group {
    page-break-inside: avoid;
  }
}
`;