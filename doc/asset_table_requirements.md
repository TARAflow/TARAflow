## UC-AS-08: View and Manage Asset Table
**Description:**  
The system provides a structured *Asset Table* that lists all assets with the following mandatory columns:  
Asset-ID | Description | Impact Criteria | Total Impact | Security Goals (CIANAAA) | Formal Security Goals.

**Preconditions:**  
- At least one asset exists in the project.

**Main Flow:**  
1. User opens the “Assets” section.
2. System displays the table with all asset entries.
3. User can sort or filter by any column (especially Impact or Asset-ID).
4. User can open an asset to edit its details.
5. User can add or remove assets (if permissions allow).

**Postconditions:**  
- All asset metadata is available in a structured, machine-readable table.

---

## UC-AS-09: Edit Asset Table Row
**Description:**  
The user edits an asset entry directly via the Asset Table.

**Main Flow:**  
1. User selects an asset row (A1, A2, …).
2. User can modify:
   - Description
   - Impact criteria values
   - Calculation mode (Conservative/Average)
   - Derived total impact
   - Security goals (CIANAAA)
   - Formal textual goals
3. System recalculates total impact automatically.
4. System saves updated data into the Asset Repository.

**Postconditions:**  
- Updated values are reflected in Threat Analysis and Attack Trees.

---

# Functional Requirements (Asset Table)

### Asset Table Structure
- **FR-AS-TBL-01:** The system shall provide a tabular view listing all assets with mandatory columns:
  - Asset-ID  
  - Description  
  - Impact Criteria (grouped or as separate sub-columns)  
  - Total Impact  
  - Security Goals (CIANAAA)  
  - Formal Security Goals  
- **FR-AS-TBL-02:** The table shall support sorting by Asset-ID, Impact, or type.
- **FR-AS-TBL-03:** The table shall support filtering (e.g., only assets with high impact).

### Editing and Synchronization
- **FR-AS-TBL-04:** Editing an asset in the table must update the internal asset repository.  
- **FR-AS-TBL-05:** The system shall automatically recalculate “Total Impact” after impact criteria changes.  
- **FR-AS-TBL-06:** Changes in security goals shall propagate to dependent Threats and Attack Trees.  

### DFD Integration
- **FR-AS-TBL-07:** The table must display which DFD element(s) each asset is linked to (at least via reference).  
- **FR-AS-TBL-08:** Removing an asset must warn if Threats or Attack Trees reference that asset.  

### Export
- **FR-AS-TBL-09:** The Asset Table shall be exportable to:
  - CSV  
  - Excel  
  - JSON  
  - PDF (as part of full report)
- **FR-AS-TBL-10:** Export must include all metadata required to reproduce the Asset Table fully.

---

# Acceptance Criteria (Asset Table)
- The Asset Table appears as a single coherent view.
- Every asset is represented as a row.
- Total Impact is automatically calculated and correct.
- CIANAAA flags are shown clearly (e.g., yes/no or icons).
- Formal security goals are visible or expandable.
- Editing a table row correctly updates all linked threat entries.
- Export includes the full table content.

