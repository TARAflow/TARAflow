import React, { useState, useCallback } from "react";
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Alert,
  Paper,
  Chip,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { AdoConfig } from "./ado-config";
import { JiraConfig } from "./jira-config";
import type {
  IntegrationTabData,
  IntegrationTool,
  IntegrationConnection,
  AzureDevOpsCredentials,
  JiraCredentials,
  ConnectionTestResult,
} from "../models/integration-types";
import {useIntegrationConnection} from "../hooks/use-integration-connection"
import * as integrationService from "../services/integration-service";

// ==================== INTEGRATION TAB ====================
// Main tab for external ticketing system integration
//
// Layout:
// 1. Tool Selection (ADO / Jira tabs)
// 2. Connection Configuration (per tool)
// 3. Project Selection
// 4. Connection Status

interface IntegrationTabProps {
  data: IntegrationTabData;
  onUpdate: (data: IntegrationTabData) => void;
}

export const IntegrationTab: React.FC<IntegrationTabProps> = ({
  data,
  onUpdate,
}) => {
  const { t } = useTranslation();

  
  const {
    activeToolTab,
    setActiveToolTab,
    currentConnection,
    isConnected,
    handleAdoCredentialsChange,
    handleAdoProjectSelect,
    handleAdoTestConnection,
    handleJiraCredentialsChange,
    handleJiraProjectSelect,
    handleJiraTestConnection,
  } = useIntegrationConnection(data, onUpdate);

  // Handle tool tab change
  const handleToolTabChange = (_event: React.SyntheticEvent, newValue: IntegrationTool) => {
    setActiveToolTab(newValue);
  };

    return (
    <Box sx={{ p: 3, maxWidth: "900px" }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
          External System Integration
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Connect to Azure DevOps or Jira to create and track security tickets
          directly from your threat model
        </Typography>
      </Box>

      {/* Connection Status Banner */}
      {isConnected && currentConnection?.projectName && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2">
              Connected to{" "}
              <strong>
                {activeToolTab === "azure-devops" ? "Azure DevOps" : "Jira"}
              </strong>
            </Typography>
            <Chip
              label={currentConnection.projectName}
              size="small"
              color="success"
            />
          </Box>
        </Alert>
      )}

      {/* Tool Selection Tabs */}
      <Paper elevation={0} sx={{ border: "1px solid #e0e0e0", mb: 3 }}>
        <Tabs
          value={activeToolTab}
          onChange={handleToolTabChange}
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          <Tab
            label="Azure DevOps"
            value="azure-devops"
            sx={{ textTransform: "none", fontWeight: 600 }}
          />
          <Tab
            label="Jira"
            value="jira"
            sx={{ textTransform: "none", fontWeight: 600 }}
          />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Azure DevOps Configuration */}
          {activeToolTab === "azure-devops" && (
            <AdoConfig
              credentials={
                currentConnection?.tool === "azure-devops"
                  ? (currentConnection.credentials as AzureDevOpsCredentials)
                  : null
              }
              selectedProject={
                currentConnection?.tool === "azure-devops"
                  ? currentConnection.projectName || null
                  : null
              }
              onCredentialsChange={handleAdoCredentialsChange}
              onProjectSelect={handleAdoProjectSelect}
              onTestConnection={handleAdoTestConnection}
            />
          )}

          {/* Jira Configuration */}
          {activeToolTab === "jira" && (
            <JiraConfig
              credentials={
                currentConnection?.tool === "jira"
                  ? (currentConnection.credentials as JiraCredentials)
                  : null
              }
              selectedProject={
                currentConnection?.tool === "jira"
                  ? currentConnection.projectName || null
                  : null
              }
              onCredentialsChange={handleJiraCredentialsChange}
              onProjectSelect={handleJiraProjectSelect}
              onTestConnection={handleJiraTestConnection}
            />
          )}
        </Box>
      </Paper>

      {/* Information Box */}
      <Paper
        elevation={0}
        sx={{ p: 3, backgroundColor: "#f5f5f5", border: "1px solid #e0e0e0" }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          Next Steps
        </Typography>
        <Typography variant="body2" component="div">
          {isConnected && currentConnection?.projectName ? (
            <>
              <p>
                ✅ You're all set! You can now create tickets for your risks in
                the Risk and Attack Tree tabs.
              </p>
              <p>
                • Individual tickets can be created using the "Create Ticket"
                button next to each risk
              </p>
              <p>
                • Batch create all tickets using the "Create All Tickets" button
              </p>
              <p>• Ticket status will be automatically synchronized</p>
            </>
          ) : (
            <>
              <p>
                1. Select your ticketing tool (Azure DevOps or Jira) using the
                tabs above
              </p>
              <p>2. Enter your connection credentials</p>
              <p>3. Click "Test Connection" to verify</p>
              <p>4. Select the project where tickets should be created</p>
            </>
          )}
        </Typography>
      </Paper>
    </Box>
  );
};