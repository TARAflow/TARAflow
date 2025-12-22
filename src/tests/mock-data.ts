import { Project } from "app";
import { ActivityLogEntry, PhaseStatus } from "shared";
import { mockAssetData } from "./test-helpers";

// ==================== MOCK DATA GENERATOR ====================

export const createMockProjects = (): Project[] => {
  const baseProjects: Project[] = [
    {
      id: "proj_1",
      name: "IoT Device Security",
      description: "Security analysis for smart home hub",
      version: "1.0",
      responsible: "Security Team",
      created: "2025-12-01T10:00:00Z",
      lastModified: "2025-12-07T15:30:00Z",
      lastOpened: "2025-12-07T16:00:00Z",
      currentPhase: 2,
      strideMethod: "per-element",
      methodSelected: true,
      phaseStatus: {
        0: "complete",
        1: "complete",
        2: "in-progress",
        3: "not-started",
        4: "not-started",
        5: "not-started",
        6: "not-started",
      },
      settings: {
        strictMode: false,
        autoSave: true,
        autoSaveInterval: 30,
      },
      tags: ["IoT", "Embedded", "high-priority"],
      team: ["Max Mustermann"],
      status: "in-progress",
      activityLog: [
        {
          timestamp: "2025-12-07T15:30:00Z",
          action: "UPDATE",
          entity: "asset",
          description: "Updated assets list",
        },
        {
          timestamp: "2025-12-07T14:20:00Z",
          action: "CREATE",
          entity: "asset",
          description: "Created 5 new assets",
        },
        {
          timestamp: "2025-12-06T11:00:00Z",
          action: "UPDATE",
          entity: "dfd",
          description: "Completed DFD diagram",
        },
      ],
      dfd: null,
      assets: mockAssetData({
        assets: [{} as any, {} as any, {} as any],
      }),
      threats: [],
      isOpen: true,
      hasUnsavedChanges: false,
    },
    {
      id: "proj_2",
      name: "Web Application TARA",
      description: "Threat analysis for customer portal",
      version: "2.1",
      responsible: "Dev Team",
      created: "2025-11-20T09:00:00Z",
      lastModified: "2025-12-05T11:00:00Z",
      lastOpened: "2025-12-07T14:00:00Z",
      currentPhase: 3,
      strideMethod: "per-interaction",
      methodSelected: true,
      phaseStatus: {
        0: "complete",
        1: "complete",
        2: "complete",
        3: "in-progress",
        4: "not-started",
        5: "not-started",
        6: "not-started",
      },
      settings: {
        strictMode: true,
        autoSave: true,
        autoSaveInterval: 30,
      },
      tags: ["Web", "Cloud"],
      team: ["Maria Schmidt", "John Doe"],
      status: "in-progress",
      activityLog: [
        {
          timestamp: "2025-12-05T11:00:00Z",
          action: "CREATE",
          entity: "threat",
          description: "Added 12 threats",
        },
        {
          timestamp: "2025-12-04T16:30:00Z",
          action: "UPDATE",
          entity: "asset",
          description: "Completed asset criticality assessment",
        },
      ],
      dfd: {} as any,
      assets: mockAssetData({
        assets: [{} as any, {} as any, {} as any],
      }),
      threats: [{} as any, {} as any],
      isOpen: true,
      hasUnsavedChanges: true,
    },
    {
      id: "proj_3",
      name: "Mobile App Security",
      description: "iOS and Android app threat model",
      version: "1.5",
      responsible: "Mobile Team",
      created: "2025-12-03T14:00:00Z",
      lastModified: "2025-12-06T16:45:00Z",
      lastOpened: "2025-12-06T17:00:00Z",
      currentPhase: 1,
      strideMethod: null,
      methodSelected: false,
      phaseStatus: {
        0: "complete",
        1: "in-progress",
        2: "not-started",
        3: "not-started",
        4: "not-started",
        5: "not-started",
        6: "not-started",
      },
      settings: {
        strictMode: false,
        autoSave: false,
        autoSaveInterval: 30,
      },
      tags: ["Mobile", "iOS", "Android"],
      team: ["Sarah Johnson"],
      status: "draft",
      activityLog: [
        {
          timestamp: "2025-12-06T16:45:00Z",
          action: "UPDATE",
          entity: "dfd",
          description: "Started DFD creation",
        },
        {
          timestamp: "2025-12-03T14:00:00Z",
          action: "CREATE",
          entity: "project",
          description: "Project created",
        },
      ],
      dfd: null,
      assets: null,
      threats: [],
      isOpen: true,
      hasUnsavedChanges: false,
    },
  ];

  // Additional closed projects for testing
  const additionalProjectNames = [
    "Cloud Infrastructure",
    "API Gateway",
    "Payment System",
    "User Authentication",
    "Database Security",
    "Network Analysis",
    "Container Security",
    "CI/CD Pipeline",
    "Microservices Architecture",
    "Legacy System Migration",
    "Third-Party Integration",
    "Data Privacy Assessment",
    "Blockchain Platform",
    "Machine Learning Model",
  ];

  const additionalProjects: Project[] = additionalProjectNames.map(
    (name, idx) => ({
      id: `proj_${idx + 4}`,
      name,
      description: `Threat analysis for ${name}`,
      version: "1.0",
      responsible: "Security Team",
      created: new Date(2025, 10, idx + 1).toISOString(),
      lastModified: new Date(2025, 11, idx + 1).toISOString(),
      lastOpened: undefined,
      currentPhase: 0,
      strideMethod: null,
      methodSelected: false,
      phaseStatus: {
        0: "not-started",
        1: "not-started",
        2: "not-started",
        3: "not-started",
        4: "not-started",
        5: "not-started",
        6: "not-started",
      },
      settings: {
        strictMode: false,
        autoSave: true,
        autoSaveInterval: 30,
      },
      tags: ["System"],
      team: [],
      status: "draft",
      activityLog: [
        {
          timestamp: new Date(2025, 10, idx + 1).toISOString(),
          action: "CREATE",
          entity: "project",
          description: "Project created",
        },
      ],
      dfd: null,
      assets: null,
      threats: [],
      isOpen: false,
      hasUnsavedChanges: false,
    })
  );

  return [...baseProjects, ...additionalProjects];
};

// ==================== EMPTY PROJECT TEMPLATE ====================

export const createEmptyProject = (
  name: string,
  description: string,
  version: string = "1.0",
  responsible: string = ""
): Project => {
  const now = new Date().toISOString();
  const id = `proj_${Date.now()}`;

  return {
    id,
    name,
    description,
    version,
    responsible,
    created: now,
    lastModified: now,
    lastOpened: now,
    currentPhase: 0,
    strideMethod: null,
    methodSelected: false,
    phaseStatus: {
      0: "in-progress",
      1: "not-started",
      2: "not-started",
      3: "not-started",
      4: "not-started",
      5: "not-started",
      6: "not-started",
    },
    settings: {
      strictMode: false,
      autoSave: true,
      autoSaveInterval: 30,
    },
    tags: [],
    team: [],
    status: "draft",
    activityLog: [
      {
        timestamp: now,
        action: "CREATE",
        entity: "project",
        description: "Project created",
      },
    ],
    dfd: null,
    assets: null,
    threats: [],
    isOpen: true,
    hasUnsavedChanges: false,
  };
};

// ==================== SAMPLE DFD DATA ====================

export const createSampleDFD = () => {
  return {
    elements: [
      {
        id: "EE-1",
        type: "ExternalEntity" as const,
        name: "Mobile User",
        description: "End user with smartphone",
        position: { x: 100, y: 150 },
        properties: { entityType: "User" },
      },
      {
        id: "P-1",
        type: "Process" as const,
        name: "Auth Service",
        description: "Handles authentication",
        position: { x: 300, y: 150 },
        properties: { technology: "Node.js" },
      },
      {
        id: "DS-1",
        type: "DataStore" as const,
        name: "User DB",
        description: "PostgreSQL database",
        position: { x: 500, y: 150 },
        properties: { storeType: "Database" },
      },
    ],
    connections: [
      {
        id: "DF-1",
        from: "EE-1",
        to: "P-1",
        label: "Login Request",
        properties: { protocol: "HTTPS", encrypted: true },
      },
      {
        id: "DF-2",
        from: "P-1",
        to: "DS-1",
        label: "Query User",
        properties: { protocol: "TCP", encrypted: false },
      },
    ],
    validation: {
      complete: true,
      warnings: [],
      lastValidated: new Date().toISOString(),
    },
  };
};
