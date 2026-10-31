// features/integration/components/tracker-project-cards.tsx
//
// The project cards of the Integration tab — icon, name and key, description,
// issue count, issue types and lead — for any tracker (adapters design §4.4).

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Grid,
  Tooltip,
  Typography,
} from "@mui/material";
import { Assignment as AssignmentIcon, CheckCircle as CheckCircleIcon } from "@mui/icons-material";
import type { TrackerProject } from "../models/integration-types";

export const TrackerProjectCards: React.FC<{
  projects: readonly TrackerProject[];
  selectedKey: string | null;
  onSelect: (project: TrackerProject) => void;
}> = ({ projects, selectedKey, onSelect }) => {
  const { t } = useTranslation();
  return (
    <Grid container spacing={2}>
      {projects.map((project) => {
        const selected = selectedKey === project.key;
        return (
          <Grid item xs={12} sm={6} key={project.id}>
            <Card
              elevation={0}
              sx={{
                border: selected ? "2px solid" : "1px solid #e0e0e0",
                borderColor: selected ? "primary.main" : "#e0e0e0",
                borderRadius: 2,
                "&:hover": { borderColor: "primary.light", boxShadow: 2 },
              }}
            >
              <CardActionArea onClick={() => onSelect(project)} data-testid={`project-card-${project.key}`}>
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                    {project.avatarUrl ? (
                      <Box component="img" src={project.avatarUrl} alt="" sx={{ width: 32, height: 32, borderRadius: 1 }} />
                    ) : (
                      <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: "primary.main" }}>
                        {project.key.slice(0, 2)}
                      </Avatar>
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap title={project.name}>
                        {project.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {project.key}
                        {project.projectTypeKey ? ` · ${project.projectTypeKey}` : ""}
                      </Typography>
                    </Box>
                    {selected && <CheckCircleIcon color="primary" sx={{ fontSize: 20, flexShrink: 0 }} />}
                  </Box>
                  {project.description && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", mb: 1 }}
                    >
                      {project.description}
                    </Typography>
                  )}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    {project.insight && (
                      <Chip
                        label={t("integration.issueCount", {
                          defaultValue: "{{count}} issues",
                          count: project.insight.totalIssueCount,
                        })}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: 11, height: 20 }}
                      />
                    )}
                    {project.issueTypes?.slice(0, 3).map((it) => (
                      <Tooltip key={it.id} title={it.name} placement="top">
                        {it.iconUrl ? (
                          <Box component="img" src={it.iconUrl} alt={it.name} sx={{ width: 16, height: 16 }} />
                        ) : (
                          <AssignmentIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                        )}
                      </Tooltip>
                    ))}
                    {project.lead && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: "auto", minWidth: 0 }}>
                        {project.lead.avatarUrl ? (
                          <Box component="img" src={project.lead.avatarUrl} alt="" sx={{ width: 16, height: 16, borderRadius: "50%" }} />
                        ) : (
                          <Avatar sx={{ width: 16, height: 16, fontSize: 10 }}>{project.lead.displayName.slice(0, 1)}</Avatar>
                        )}
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {project.lead.displayName}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
};
