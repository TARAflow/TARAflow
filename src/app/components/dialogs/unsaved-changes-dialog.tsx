import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from "shared";

// ==================== UNSAVED CHANGES DIALOG ====================

interface UnsavedChangesDialogProps {
  projectName: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  projectName,
  onSave,
  onDiscard,
  onCancel
}) => {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {t('dialogs.unsavedChanges.title')}
            </h3>
            <p className="text-gray-600 text-sm mt-1">
              {t('dialogs.unsavedChanges.message', { name: projectName })}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={onCancel}
            className="flex-1"
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="secondary"
            onClick={onDiscard}
            className="flex-1"
          >
            {t('dialogs.unsavedChanges.discard')}
          </Button>
          <Button
            variant="primary"
            onClick={onSave}
            className="flex-1"
          >
            {t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
};
