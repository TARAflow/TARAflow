export interface IElement {
    id: number
    name: string
    type: string
    x1y1: { x1: number, y1: number }
    x2y1: { x2: number, y1: number }
    x1y2: { x1: number, y2: number }
    x2y2: { x2: number, y2: number }
    inTrustBoundary: Array<number>
}

export interface ITrustBoundary{
    id: number
    name: string
    type: string
    x1y1: { x1: number, y1: number }
    x2y1: { x2: number, y1: number }
    x1y2: { x1: number, y2: number }
    x2y2: { x2: number, y2: number }
}

export interface IDataFlow{
    id: number
    name: string
    type: string
    sourceId: number
    targetId: number
    enumeration: number
}

export interface IDiagram {
    dataFlowsArray: Array<IDataFlow>,
    elementsArray: Array<IElement>,
    trustBoundariesArray: Array<ITrustBoundary>
}

export interface ICrossingElements {
    dataflow: IDataFlow,
    elements: {
        sourceElement: IElement,
        targetElement: IElement
    },
    crossingTrustBoundaries: Array<ITrustBoundary>
}
