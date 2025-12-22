import {
  IDataFlow,
  IDiagram,
  ITrustBoundary,
  IElement,
  ICrossingElements,
} from "../interfaces/drawio-interfaces";



export default class DiagramAnalyser {
  private diagramElements: IDiagram;
  private elementsCrossingTrustBoundaries: ICrossingElements[];
  private notAllowedElements: Element[];
  private dataflowsWithoutSourceOrTarget: IDataFlow[];

  constructor() {
    this.diagramElements = {} as IDiagram;
    this.elementsCrossingTrustBoundaries = {} as ICrossingElements[];
    this.notAllowedElements = [];
    this.dataflowsWithoutSourceOrTarget = [];
  }

  private createElementToAdd(
    cell: Element,
    geometryElement: Element,
    type: string
  ) {
    const baseElement = {
      id: parseInt(cell.getAttribute("id")!),
      type: type,
      name: cell.getAttribute("value")!,
    };
    const trustBoundaryElement = {
      ...baseElement,
      x1y1: {
        x1: parseInt(geometryElement.getAttribute("x")!),
        y1: parseInt(geometryElement.getAttribute("y")!),
      },
      x2y1: {
        x2:
          parseInt(geometryElement.getAttribute("width")!) +
          parseInt(geometryElement.getAttribute("x")!),
        y1: parseInt(geometryElement.getAttribute("y")!),
      },
      x1y2: {
        x1: parseInt(geometryElement.getAttribute("x")!),
        y2:
          parseInt(geometryElement.getAttribute("height")!) +
          parseInt(geometryElement.getAttribute("y")!),
      },
      x2y2: {
        x2:
          parseInt(geometryElement.getAttribute("width")!) +
          parseInt(geometryElement.getAttribute("x")!),
        y2:
          parseInt(geometryElement.getAttribute("height")!) +
          parseInt(geometryElement.getAttribute("y")!),
      },
    };
    const baseDfdElement = {
      ...trustBoundaryElement,
      inTrustBoundary: [],
    };

    switch (type) {
      case "Dataflow":
        return {
          ...baseElement,
          sourceId: parseInt(cell.getAttribute("source")!),
          targetId: parseInt(cell.getAttribute("target")!),
          enumeration: null,
        };
      case "TrustBoundary":
        return {
          ...trustBoundaryElement,
        };
      default:
        return {
          ...baseDfdElement,
        };
    }
  }

  private checkIfSourceAndTargetExist(elementToAdd: any): boolean {
    return !isNaN(elementToAdd.targetId) && !isNaN(elementToAdd.sourceId);
  }

  private navigateElementToCorrectArray(elementToAdd: any, type: string) {
    if (type === "Dataflow") {
      if (!this.checkIfSourceAndTargetExist(elementToAdd)) {
        this.dataflowsWithoutSourceOrTarget.push(elementToAdd);
        alert(
          "Source and/or target is missing for dataflow: " + elementToAdd.name
        );
        return;
      }
      this.diagramElements.dataFlowsArray.push(elementToAdd);
    } else if (type === "TrustBoundary") {
      this.diagramElements.trustBoundariesArray.push(elementToAdd);
    } else {
      this.diagramElements.elementsArray.push(elementToAdd);
    }
  }

  private calculateIfElementInTrustBoundary(
    element: any,
    trustBoundary: any
  ): boolean {
    return (
      element.x1y1.x1 >= trustBoundary.x1y1.x1 &&
      element.x1y1.y1 >= trustBoundary.x1y1.y1 &&
      element.x2y1.x2 <= trustBoundary.x2y1.x2 &&
      element.x2y1.y1 >= trustBoundary.x2y1.y1 &&
      element.x2y2.x2 <= trustBoundary.x2y2.x2 &&
      element.x2y2.y2 <= trustBoundary.x2y2.y2 &&
      element.x1y2.x1 >= trustBoundary.x1y2.x1 &&
      element.x1y2.y2 <= trustBoundary.x1y2.y2
    );
  }

  private addInTrustBoundaryAttributeToDfdElement(element: any): void {
    this.diagramElements.trustBoundariesArray.forEach((trustBoundary) => {
      if (this.calculateIfElementInTrustBoundary(element, trustBoundary)) {
        element.inTrustBoundary.push(trustBoundary.id);
      }
    });
  }

  private findDataflowsCrossingTrustBoundary() {
    this.diagramElements.dataFlowsArray.forEach((dataflow) => {
      const sourceElement = this.diagramElements.elementsArray.find(
        (element) => element.id === dataflow.sourceId
      );
      const targetElement = this.diagramElements.elementsArray.find(
        (element) => element.id === dataflow.targetId
      );

      if (!sourceElement || !targetElement) {
        return;
      }

      const sourceTrustBoundaries = sourceElement.inTrustBoundary;
      const targetTrustBoundaries = targetElement.inTrustBoundary;
      const insideSameTrustBoundary =
        sourceTrustBoundaries.every((value) =>
          targetTrustBoundaries.includes(value)
        ) &&
        targetTrustBoundaries.every((value) =>
          sourceTrustBoundaries.includes(value)
        );

      if (!insideSameTrustBoundary) {
        this.elementsCrossingTrustBoundaries.push({
          dataflow: dataflow,
          elements: {
            sourceElement: sourceElement,
            targetElement: targetElement,
          },
          crossingTrustBoundaries:
            this.diagramElements.trustBoundariesArray.filter(
              (trustBoundary) => {
                return (
                  sourceElement.inTrustBoundary.includes(trustBoundary.id) ||
                  targetElement.inTrustBoundary.includes(trustBoundary.id)
                );
              }
            ),
        });
      }
    });
  }

  parseDifferentDfdElementsFromXml(xmlDoc: XMLDocument): {
    crossingElements: ICrossingElements[];
    invalidDataflows: boolean;
  } {
    const mxCells = xmlDoc.getElementsByTagName("mxCell");

    this.diagramElements = {
      dataFlowsArray: new Array<IDataFlow>(),
      elementsArray: new Array<IElement>(),
      trustBoundariesArray: new Array<ITrustBoundary>(),
    };
    this.elementsCrossingTrustBoundaries = new Array<ICrossingElements>();
    this.notAllowedElements = [];
    this.dataflowsWithoutSourceOrTarget = [];

    Array.from(mxCells).forEach((cell) => {
      const type: string | null = cell.getAttribute("type");
      if (!type) {
        if (
          cell.getAttribute("id") !== "0" &&
          cell.getAttribute("id") !== "1" &&
          cell.getAttribute("value") !==
            "Note that <u><b>only</b></u> elements from the <br>CoReTM Library will be analysed."
        ) {
          this.notAllowedElements.push(cell);
        }
        return;
      }

      const geometryElement = cell.getElementsByTagName("mxGeometry")[0];
      if (!geometryElement) {
        return;
      }

      const elementToAdd = this.createElementToAdd(cell, geometryElement, type);
      if (elementToAdd) {
        this.navigateElementToCorrectArray(elementToAdd, type);
      }
    });

    this.diagramElements.elementsArray.forEach((element) => {
      this.addInTrustBoundaryAttributeToDfdElement(element);
    });

    this.findDataflowsCrossingTrustBoundary();

    if (this.notAllowedElements.length > 0) {
      alert(
        "Your diagram contains elements that are not part of the CoReTM Library. " +
          "These elements will not be considered in the analysis. " +
          "Please check the console for more information."
      );
      console.log(
        "Elements that are not part of the CoReTM library: ",
        this.notAllowedElements
      );
    }
    let i: number = 1;
    this.diagramElements.dataFlowsArray.forEach((dataflow) => {
      dataflow.enumeration = i;
      i++;
    });

    console.log("crossing", this.elementsCrossingTrustBoundaries);
    console.log("invalid DF", this.dataflowsWithoutSourceOrTarget);
    console.log(
      "are there invalid DFs",
      this.dataflowsWithoutSourceOrTarget.length > 0
    );

    return {
      crossingElements: this.elementsCrossingTrustBoundaries,
      invalidDataflows: this.dataflowsWithoutSourceOrTarget.length > 0,
    };
  }
}

export const diagramAnalyser = new DiagramAnalyser();