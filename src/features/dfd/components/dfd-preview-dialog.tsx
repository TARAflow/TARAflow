// ==================== DFD PREVIEW DIALOG ====================
// Single Responsibility: Display DFD preview image with download option

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import { Image as ImageIcon } from '@mui/icons-material';

interface DFDPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  previewImage: string | null;
  projectName: string;
}

export const DFDPreviewDialog: React.FC<DFDPreviewDialogProps> = ({
  open,
  onClose,
  previewImage,
  projectName,
}) => {
  const { t } = useTranslation();

  const handleDownload = () => {
    if (!previewImage) return;
    
    const link = document.createElement('a');
    link.href = previewImage;
    link.download = `${projectName}_DFD.svg`;
    link.click();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{t('tabs.dfd.preview.title', { defaultValue: 'DFD Preview' })}</DialogTitle>
      
      <DialogContent>
        {previewImage ? (
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              p: 2, 
              bgcolor: 'grey.50',
              borderRadius: 1,
            }}
          >
            <img
              src={previewImage}
              alt="DFD Preview"
              style={{ 
                maxWidth: '100%', 
                maxHeight: '60vh', 
                objectFit: 'contain' 
              }}
            />
          </Box>
        ) : (
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center',
              justifyContent: 'center', 
              p: 4 
            }}
          >
            <CircularProgress size={24} />
            <Typography sx={{ ml: 2 }}>
              {t('tabs.dfd.preview.generating', { defaultValue: 'Generating preview...' })}
            </Typography>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        {previewImage && (
          <Button onClick={handleDownload} startIcon={<ImageIcon />}>
            {t('tabs.dfd.preview.download', { defaultValue: 'Download' })}
          </Button>
        )}
        <Button onClick={onClose}>
          {t('common.close', { defaultValue: 'Close' })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DFDPreviewDialog;