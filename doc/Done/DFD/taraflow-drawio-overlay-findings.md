# TARAflow – draw.io Overlay: Erkenntnisse & Implementierungsplan

## Kontext

Ziel: Asset-Relations (z.B. `modifies`, `runs_on`, `transports`, `affects_safety`) als farbige
Overlay-Pfeile im DFD-Tab einblenden – ohne das Basis-Diagramm zu verändern.

---

## Entscheidung: Kein persistentes Label im Diagramm

**Verworfene Idee:** Feste Labels pro Element (visible/hidden flags)  
**Problem:** Bläht das XML auf, Sync-Probleme mit Asset-Graph, Undo/Redo-Probleme  
**Lösung:** Overlay als reine View – Basis-XML bleibt immer sauber

---

## Technische Grundlage

draw.io läuft als `<iframe src="https://embed.diagrams.net">`.  
Kommunikation erfolgt ausschliesslich via **postMessage API**.

### Bestätigte API-Calls

```javascript
// XML exportieren
iframe.contentWindow.postMessage(JSON.stringify({ action: 'export', format: 'xml' }), '*');

// XML laden
iframe.contentWindow.postMessage(JSON.stringify({ action: 'load', xml: '<mxfile>...</mxfile>' }), '*');
```

### Events empfangen

```javascript
window.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.event === 'export') { /* msg.xml enthält das komprimierte XML */ }
  if (msg.event === 'load')   { /* Bestätigung */ }
});
```

---

## Wichtig: XML ist komprimiert

Das `<diagram>`-Element enthält **base64+deflate-raw** komprimierten Inhalt.  
Direktes Parsen funktioniert nicht – erst dekomprimieren.

### Dekomprimierung (Browser-nativ)

```javascript
async function decompressDiagram(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  writer.write(bytes);
  writer.close();

  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return new TextDecoder().decode(new Uint8Array(chunks.flatMap(c => [...c])));
}

// Verwendung
const parser = new DOMParser();
const doc = parser.parseFromString(window._baseXml, 'text/xml');
const compressedContent = doc.querySelector('diagram').textContent;

decompressDiagram(compressedContent).then(xml => {
  const decoded = decodeURIComponent(xml); // zusätzlich URL-decode!
  window._decompressedXml = decoded;
});
```

> ⚠️ Das Resultat ist **URL-encoded** – zwingend `decodeURIComponent()` anwenden.

---

## Overlay einfügen: Vollständige Pipeline (Proof of Concept)

```javascript
// 1. Dekodiertes XML parsen
const parser = new DOMParser();
const doc = parser.parseFromString(window._decompressedXml, 'text/xml');
const root = doc.querySelector('root');

// 2. Overlay-Edge hinzufügen
const edge = doc.createElement('mxCell');
edge.setAttribute('id', 'overlay-modifies-1');
edge.setAttribute('value', 'modifies');
edge.setAttribute('style', 'edgeStyle=orthogonalEdgeStyle;strokeColor=#FF6600;strokeWidth=2;fontColor=#FF6600;fontSize=10;dashed=1;');
edge.setAttribute('edge', '1');
edge.setAttribute('source', '4');   // draw.io Cell-ID des Quell-Elements
edge.setAttribute('target', '21');  // draw.io Cell-ID des Ziel-Elements
edge.setAttribute('parent', '1');
const geo = doc.createElement('mxGeometry');
geo.setAttribute('relative', '1');
geo.setAttribute('as', 'geometry');
edge.appendChild(geo);
root.appendChild(edge);

// 3. Serialisieren und in mxfile wrappen (unkomprimiert laden – draw.io akzeptiert das)
const serializer = new XMLSerializer();
const newGraphXml = serializer.serializeToString(doc);
const wrappedXml = `<mxfile><diagram id="ORIGINAL_DIAGRAM_ID" name="Page-1">${newGraphXml}</diagram></mxfile>`;

// 4. In draw.io laden
iframe.contentWindow.postMessage(JSON.stringify({ action: 'load', xml: wrappedXml }), '*');
```

### Overlay entfernen (Reset)

```javascript
// Basis-XML (komprimiert, original) neu laden
iframe.contentWindow.postMessage(JSON.stringify({ action: 'load', xml: window._baseXml }), '*');
```

---

## Farbschema (Empfehlung)

```typescript
const RELATION_OVERLAY_COLORS: Record<string, string> = {
  modifies:       '#FF6600', // orange
  runs_on:        '#0066FF', // blau
  transports:     '#00AA44', // grün
  affects_safety: '#CC0000', // rot
};
```

---

## Architektur-Skizze für DrawioController (TypeScript)

```typescript
class DrawioController {
  private baseXml: string = '';           // komprimiertes Original-XML
  private decompressedXml: string = '';   // dekomprimiertes XML für Manipulation

  // Beim Load-Event des Diagramms
  onDiagramLoad(xml: string) {
    this.baseXml = xml;
    this.decompress(xml).then(d => { this.decompressedXml = d; });
  }

  // Overlay anzeigen für eine Relation-Kategorie
  showRelationOverlay(
    category: string,
    relations: Array<{ sourceId: string; targetId: string }>
  ) {
    const overlayXml = this.buildOverlayXml(this.decompressedXml, category, relations);
    this.loadXml(overlayXml);
  }

  // Overlay entfernen
  clearOverlay() {
    this.loadXml(this.baseXml);
  }

  private buildOverlayXml(baseXml: string, category: string, relations: ...) {
    // DOMParser → Edges einfügen → XMLSerializer → wrappen
  }

  private loadXml(xml: string) {
    this.iframe.contentWindow?.postMessage(JSON.stringify({ action: 'load', xml }), '*');
  }
}
```

---

## UX-Mechanik (geplant)

- Im Asset-Sidepanel: Radio-Button / Toggle pro Relation-Kategorie
- Immer nur **eine Kategorie** aktiv (kein Spaghetti-Diagramm)
- Spätere Erweiterung: Mehrere Kategorien gleichzeitig, Heatmaps, Attack-Path-Highlighting

---

## Offene Punkte / Nächste Schritte

- [ ] DFD-Modell-Erweiterung abschliessen (zuerst)
- [ ] DrawioController: `decompress()`-Methode implementieren
- [ ] Asset-zu-DFD-Cell-ID Mapping sicherstellen (UUID → mxCell id)
- [ ] `buildOverlayXml()` implementieren mit Relation-Lookup aus Asset-Graph
- [ ] Overlay-Toggle UI im Asset-Sidepanel
