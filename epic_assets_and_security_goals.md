# Epic: Assets and Security Goals

## 1. Description
This epic defines requirements for identifying, managing and analysing assets within the threat-modeling workflow.  
An *asset* is any data, component, data flow, process, function, or subsystem that has value within the system and requires protection.  
Assets form the basis for deriving security goals (e.g., C, I, A, AuthN, AuthZ, Accountability) and evaluating impact during threat analysis.

This epic ensures:
- Consistent identification of assets within DFDs
- Structured impact assessment
- Derivation of formal security goals
- Reuse of assets across STRIDE, Attack Trees and Risk Assessment

---

## 2. Actors
- **Security Analyst** – Identifies assets, rates impact, defines security goals  
- **System Architect** – Provides system design and architecture documentation  
- **Tool User** – Interacts with the UI and selects/reuses assets  
- **Threat Model Engine** – Manages storage, references and automated scoring

---

## 3. Use Cases

### UC-AS-01: Create Asset
**Description:**  
User creates a new asset and assigns metadata.

**Preconditions:**
- Project exists
- Architecture/DFD loaded

**Main Flow:**
1. User clicks "Create Asset"
2. User enters:  
   - Asset name  
   - Description  
   - Asset type (Data, Data Flow, Process, Component, System, Function)  
3. System generates an Asset-ID (A1, A2, …)
4. Asset stored in the asset repository

**Postconditions:**
- Asset available for impact rating and DFD linking.

---

### UC-AS-02: Assign Asset to DFD Element
**Description:**  
User links one or more assets to a DFD element (process, store, flow, external entity).

**Main Flow:**
1. User selects a DFD element
2. User opens "Assign Assets"
3. User selects one or more assets
4. System stores the linkage in metadata (XML/JSON)

**Postconditions:**
- Threat Analysis can automatically infer affected assets based on DFD location.

---

### UC-AS-03: Assess Asset Impact
**Description:**  
Analyst evaluates the business/physical impact of asset compromise.

**Main Flow:**
1. User selects asset
2. User chooses rating method:  
   - Conservative  
   - Average  
3. User evaluates configured impact criteria (5–7 criteria)
4. System calculates overall impact score

**Alternative Flow:**
- Analyst adjusts impact criteria weighting (if allowed)

---

### UC-AS-04: Define Security Goals (CIANAA + Formal Goals)
**Description:**  
User defines the required security goals for the asset.

**Main Flow:**
1. User selects checkboxes for:  
   - Confidentiality  
   - Integrity  
   - Availability  
   - Authentication  
   - Authorization  
   - Accountability (optional, context-based)
2. User enters formal textual security goals (e.g.  
   *“Configuration data must only be modified by authorized and authenticated personnel.”*)
3. System stores both goal sets

**Postconditions:**
- Threat Analysis references selected goals.

---

### UC-AS-05: Use Asset in Threat Analysis
**Description:**  
Threat Analysis imports asset metadata (impact + security goals) and links threats directly to asset IDs.

**Main Flow:**
1. System displays available assets for threat selection
2. User selects asset(s) relevant to a STRIDE-derived threat
3. Threat entry automatically inherits:
   - Asset impact
   - Required security goals
4. Threat saved with reference to Asset-ID(s)

---

### UC-AS-06: Select Asset for Attack Tree Creation
**Description:**  
If analyst needs granular likelihood assessment, the asset is selected when creating an Attack Tree.

**Main Flow:**
1. User creates new Attack Tree  
2. User selects associated asset(s)  
3. System preloads security goals + impact rating  
4. User builds tree

---

### UC-AS-07: Export/Report Assets
**Description:**  
User exports all assets for documentation or audit purposes (PDF/Excel/JSON).

---

## 4. Functional Requirements

### Asset Identification & Metadata
- FR-AS-01: The system shall allow creation of assets with unique Asset-IDs.
- FR-AS-02: The system shall store asset type, description, and associated DFD elements.
- FR-AS-03: The system shall allow linking multiple assets to a single DFD element.
- FR-AS-04: The system shall allow linking a single asset to multiple DFD elements.

### Impact Assessment
- FR-AS-05: The system shall support customizable impact criteria (min. 5).
- FR-AS-06: The system shall compute an overall impact score.
- FR-AS-07: The system shall support conservative vs. average calculation modes.

### Security Goals
- FR-AS-08: The system shall allow assigning C, I, A, AuthN, AuthZ and Accountability.
- FR-AS-09: The system shall support entry of formal security goal descriptions.
- FR-AS-10: Security goals shall be referenced by threats and attack trees.

### Integration with Threat Analysis
- FR-AS-11: STRIDE threats shall reference Asset-IDs.
- FR-AS-12: The system shall automatically show relevant assets during threat creation.
- FR-AS-13: Assets assigned to DFD elements shall appear as default suggestions.

### Integration with Attack Trees
- FR-AS-14: Attack Trees shall reference Asset-IDs.
- FR-AS-15: Attack Trees shall inherit impact and security goals of the asset.
- FR-AS-16: Mitigations applied in Attack Trees shall update threat likelihood values.

---

## 5. Non-Functional Requirements
- NFR-AS-01: Asset-ID format must be stable, unique and human-readable.
- NFR-AS-02: Linking between Assets → DFD → Threat → Attack Tree must be traceable.
- NFR-AS-03: Export formats must preserve Asset-ID relationships.
- NFR-AS-04: API must provide CRUD operations for assets.

---

## 6. Data Model (Simplified)
```json
{
  "assetId": "A3",
  "name": "User Credential Data",
  "type": "Data",
  "description": "Contains hashed user credentials.",
  "impact": {
    "criteria": {
      "business": 4,
      "reputation": 5,
      "safety": 2,
      "privacy": 5,
      "physical": 1
    },
    "mode": "conservative",
    "total": 5
  },
  "securityGoals": {
    "confidentiality": true,
    "integrity": true,
    "availability": false,
    "authentication": true,
    "authorization": true,
    "accountability": true,
    "formal": [
      "Credential data must not be disclosed to unauthorized parties.",
      "Only the authentication subsystem may modify credential records."
    ]
  },
  "dfdRefs": ["P2", "DS1"]
}
