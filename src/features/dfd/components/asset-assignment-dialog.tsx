// ==================== ASSET ASSIGNMENT DIALOG ====================
// Dialog to assign assets to DFD elements with relation types

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Box,
  Typography,
  Chip,
  TextField,
  InputAdornment,
  FormGroup,
  FormControlLabel,
  Collapse,
  Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import type { DFDAsset, AssetRelation, AssetRelationType } from '../models/dfd-types';

// ==================== TYPES ====================

interface AssetAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  elementId: string | null;
  elementLabel: string | null;
  elementType: string | null | undefined;
  availableAssets: DFDAsset[];
  currentAssignments: AssetRelation[];
  onSave: (relations: AssetRelation[]) => void;
}

// ==================== RELATION TYPE MAPPING ====================

const ELEMENT_RELATION_TYPES: Record<string, AssetRelationType[]> = {
  process: ['creates', 'deletes', 'read', 'modify'],
  datastore: ['stores', 'deletes'],
  dataflow: ['transports'],
  interface: ['transports', 'stores'],
  externalentity: [],
  trustboundary: [],
};

const RELATION_TYPE_LABELS: Record<AssetRelationType, string> = {
  stores: 'Stores',
  read: 'Read',
  modify: 'Modify',
  creates: 'Creates',
  deletes: 'Deletes',
  transports: 'Transports',
};

// Asset category icons
const getCategoryIcon = (category?: string): string => {
  switch (category?.toLowerCase()) {
    case 'daten':
    case 'data':
      return '📄';
    case 'systeme':
    case 'systems':
      return '💻';
    case 'infrastruktur':
    case 'infrastructure':
      return '🏭';
    case 'prozesse':
    case 'processes':
      return '🔄';
    case 'menschen':
    case 'people':
      return '👤';
    default:
      return '📦';
  }
};

// ==================== COMPONENT ====================

export const AssetAssignmentDialog: React.FC<AssetAssignmentDialogProps> = ({
  open,
  onClose,
  elementId,
  elementLabel,
  elementType,
  availableAssets,
  currentAssignments,
  onSave,
}) => {
  const [relations, setRelations] = useState<AssetRelation[]>(currentAssignments);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);

  // Get allowed relation types for this element type
  const allowedTypes = elementType ? ELEMENT_RELATION_TYPES[elementType.toLowerCase()] || [] : [];
  const canAssignAssets = allowedTypes.length > 0;

  // Update relations when dialog opens with new data
  useEffect(() => {
    if (open) {
      setRelations(currentAssignments);
      setSearchQuery('');
      setExpandedAsset(null);
    }
  }, [open, currentAssignments]);

  // Filter assets based on search
  const filteredAssets = availableAssets.filter(asset =>
    asset.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.properties?.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if asset is assigned
  const isAssetAssigned = (assetId: string): boolean => {
    return relations.some(r => r.assetId === assetId);
  };

  // Get relation types for an asset
  const getAssetRelationTypes = (assetId: string): AssetRelationType[] => {
    const relation = relations.find(r => r.assetId === assetId);
    return relation?.relationTypes || [];
  };

  // Get notes for an asset
  const getAssetNotes = (assetId: string): string => {
    const relation = relations.find(r => r.assetId === assetId);
    return relation?.notes || '';
  };

  // Toggle asset assignment
  const handleToggleAsset = (assetId: string) => {
    if (isAssetAssigned(assetId)) {
      // Remove relation
      setRelations(prev => prev.filter(r => r.assetId !== assetId));
      if (expandedAsset === assetId) {
        setExpandedAsset(null);
      }
    } else {
      // Add relation with all types selected by default
      setRelations(prev => [
        ...prev,
        { assetId, relationTypes: [...allowedTypes] }
      ]);
      setExpandedAsset(assetId);
    }
  };

  // Toggle individual relation type for an asset
  const handleToggleRelationType = (assetId: string, relationType: AssetRelationType) => {
    setRelations(prev => prev.map(relation => {
      if (relation.assetId === assetId) {
        const hasType = relation.relationTypes.includes(relationType);
        return {
          ...relation,
          relationTypes: hasType
            ? relation.relationTypes.filter(t => t !== relationType)
            : [...relation.relationTypes, relationType]
        };
      }
      return relation;
    }));
  };

  // Update notes for an asset
  const handleNotesChange = (assetId: string, notes: string) => {
    setRelations(prev => prev.map(relation => {
      if (relation.assetId === assetId) {
        return { ...relation, notes: notes || undefined };
      }
      return relation;
    }));
  };

  const handleSave = () => {
    if (elementId) {
      // Filter out relations with no types
      const validRelations = relations.filter(r => r.relationTypes.length > 0);
      onSave(validRelations);
      onClose();
    }
  };

  const handleCancel = () => {
    setRelations(currentAssignments); // Reset
    onClose();
  };

  const assignedCount = relations.length;
  const hasChanges = JSON.stringify(relations.sort((a, b) => a.assetId.localeCompare(b.assetId))) 
    !== JSON.stringify(currentAssignments.sort((a, b) => a.assetId.localeCompare(b.assetId)));

  return (
    <Dialog 
      open={open} 
      onClose={handleCancel} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { height: '75vh' }
      }}
    >
      <DialogTitle>
        <Box>
          <Typography variant="h6" gutterBottom>
            Manage Assets
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              Element: <strong>{elementLabel || elementId}</strong>
            </Typography>
            <Chip 
              label={elementType || 'unknown'} 
              size="small" 
              variant="outlined"
            />
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {!canAssignAssets ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              Elements of type <strong>{elementType}</strong> cannot have assets assigned.
            </Typography>
          </Box>
        ) : (
          <>
            {/* Search Bar */}
            <TextField
              fullWidth
              size="small"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />

            {/* Selection Summary */}
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Assigned:
              </Typography>
              <Chip 
                label={assignedCount} 
                size="small" 
                color={assignedCount > 0 ? 'primary' : 'default'}
              />
              {hasChanges && (
                <Chip 
                  label="Modified" 
                  size="small" 
                  color="warning" 
                  variant="outlined"
                />
              )}
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Asset List */}
            {filteredAssets.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">
                  {searchQuery ? 'No assets match your search' : 'No assets available'}
                </Typography>
              </Box>
            ) : (
              <List sx={{ pt: 0 }}>
                {filteredAssets.map(asset => {
                  const assigned = isAssetAssigned(asset.id);
                  const relationTypes = getAssetRelationTypes(asset.id);
                  const notes = getAssetNotes(asset.id);
                  const isExpanded = expandedAsset === asset.id;
                  const categoryIcon = getCategoryIcon(asset.properties?.category);

                  return (
                    <Box key={asset.id} sx={{ mb: 1 }}>
                      {/* Asset Selection */}
                      <ListItem
                        button
                        onClick={() => handleToggleAsset(asset.id)}
                        sx={{
                          borderRadius: 1,
                          bgcolor: assigned ? 'action.selected' : undefined,
                          '&:hover': {
                            bgcolor: assigned ? 'action.selected' : 'action.hover',
                          },
                        }}
                      >
                        <ListItemIcon>
                          <Checkbox
                            edge="start"
                            checked={assigned}
                            tabIndex={-1}
                            disableRipple
                          />
                        </ListItemIcon>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Typography>{categoryIcon}</Typography>
                        </ListItemIcon>
                        <ListItemText
                          primary={asset.name}
                          secondary={asset.properties?.description || 'No description'}
                          primaryTypographyProps={{
                            fontWeight: assigned ? 600 : 400,
                          }}
                        />
                        {assigned && (
                          <Box
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedAsset(isExpanded ? null : asset.id);
                            }}
                            sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5 }}
                          >
                            <Chip 
                              label={`${relationTypes.length} type${relationTypes.length !== 1 ? 's' : ''}`}
                              size="small" 
                              color="primary"
                              variant="outlined"
                            />
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </Box>
                        )}
                      </ListItem>

                      {/* Relation Type Selection (Expandable) */}
                      {assigned && (
                        <Collapse in={isExpanded} timeout="auto">
                          <Box sx={{ pl: 9, pr: 2, py: 2, bgcolor: 'action.hover', borderRadius: 1, mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                              Select relation types:
                            </Typography>
                            <FormGroup row>
                              {allowedTypes.map(relationType => (
                                <FormControlLabel
                                  key={relationType}
                                  control={
                                    <Checkbox
                                      size="small"
                                      checked={relationTypes.includes(relationType)}
                                      onChange={() => handleToggleRelationType(asset.id, relationType)}
                                    />
                                  }
                                  label={RELATION_TYPE_LABELS[relationType] || relationType}
                                />
                              ))}
                            </FormGroup>
                            {relationTypes.length === 0 && (
                              <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                                ⚠️ At least one relation type must be selected
                              </Typography>
                            )}
                            
                            {/* Notes Field */}
                            <TextField
                              fullWidth
                              multiline
                              rows={2}
                              size="small"
                              label="Notes (optional)"
                              placeholder="Add notes about this relationship..."
                              value={notes}
                              onChange={(e) => handleNotesChange(asset.id, e.target.value)}
                              sx={{ mt: 2 }}
                            />
                          </Box>
                        </Collapse>
                      )}
                    </Box>
                  );
                })}
              </List>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleCancel}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          disabled={!hasChanges || !canAssignAssets}
        >
          Save ({assignedCount})
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssetAssignmentDialog;