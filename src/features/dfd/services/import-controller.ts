


export default class ImportController {
  parseFile(fileContent: string): { success: boolean } {
    try {
      const parsedData = JSON.parse(fileContent);
      if (!parsedData) {
        alert("Failed to parse the file. Please upload a valid model.");
        return { success: false };
      }

      localStorage.clear();

      if (parsedData.ProjectName) {
        localStorage.setItem("ProjectName", parsedData.ProjectName);
      }

      if (parsedData.Diagram) {
        const xmlDoc: XMLDocument = new DOMParser().parseFromString(
          parsedData.Diagram,
          "text/xml"
        );
        const parseError = xmlDoc.getElementsByTagName("parsererror");
        if (parseError.length > 0) {
          alert(
            "Failed to parse the Diagram XML. Please upload a valid model."
          );
          return { success: false };
        }
        localStorage.setItem(
          "DrawioMsg",
          JSON.stringify({ xml: parsedData.Diagram })
        );
      }

      if (parsedData.OverviewTable && parsedData.OverviewTable !== "[]") {
        const overviewTable = JSON.parse(parsedData.OverviewTable);
        localStorage.setItem("OverviewTable", JSON.stringify(overviewTable));
      }

      if (parsedData.ThreatTables && parsedData.ThreatTables !== "[]") {
        const threatTables = JSON.parse(parsedData.ThreatTables);
        localStorage.setItem("ThreatTables", JSON.stringify(threatTables));
      }
      return { success: true };
    } catch (error) {
      console.error("Error parsing file:", error);
      return { success: false };
    }
  }
}

