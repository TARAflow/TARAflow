import { Box, Alert, Button, Stack, Chip, Typography, Collapse } from "@mui/material";
import { Sync as SyncIcon } from "@mui/icons-material";

import type { RiskSyncStatus } from "../services/risk-sync-service";

type Props = {
  needsSync: boolean;
  isSyncing: boolean;
  syncStatus: RiskSyncStatus;
  onSync: () => void;
};

export const RiskSyncBanner: React.FC<Props> = ({
  needsSync,
  isSyncing,
  syncStatus,
  onSync,
}) => {
  return (
    <Collapse in={needsSync}>
      <Box sx={{ px: 2, py: 1 }}>
        <Alert
          severity="warning"
          action={
            <Button
              color="warning"
              size="small"
              startIcon={<SyncIcon />}
              onClick={onSync}
              disabled={isSyncing}
            >
              Sync Now
            </Button>
          }
        >
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            flexWrap="wrap"
          >
            <Typography variant="body2">
              Risks are out of sync with Threats:
            </Typography>

            {syncStatus.newThreats > 0 && (
              <Chip
                label={`${syncStatus.newThreats} new`}
                size="small"
                color="success"
                variant="outlined"
              />
            )}
            {syncStatus.orphanedRisks > 0 && (
              <Chip
                label={`${syncStatus.orphanedRisks} orphaned`}
                size="small"
                color="error"
                variant="outlined"
              />
            )}
            {syncStatus.changedDescriptions > 0 && (
              <Chip
                label={`${syncStatus.changedDescriptions} changed`}
                size="small"
                color="warning"
                variant="outlined"
              />
            )}
            {syncStatus.changedMitigations > 0 && (
              <Chip
                label={`${syncStatus.changedMitigations} mitigations changed`}
                size="small"
                color="warning"
                variant="outlined"
              />
            )}
            {syncStatus.changedExposureLevels > 0 && (
              <Chip
                label={`${syncStatus.changedExposureLevels} exposure level${
                  syncStatus.changedExposureLevels === 1 ? "" : "s"
                } changed`}
                size="small"
                color="warning"
                variant="outlined"
              />
            )}
            {syncStatus.uncertainRisks > 0 && (
              <Chip
                label={`${syncStatus.uncertainRisks} uncertain`}
                size="small"
                color="warning"
                variant="outlined"
              />
            )}
          </Stack>
        </Alert>
      </Box>
    </Collapse>
  );
};