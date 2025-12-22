import React, { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, Edit3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ==================== RENAME PROJECT DIALOG ====================

interface RenameProjectDialogProps {
  currentName: string;
  projectId: string;
  onClose: () => void;
  onRename: (projectId: string, newName: string) => void;
  existingProjectNames?: string[];
}

export const RenameProjectDialog: React.FC<RenameProjectDialogProps> = ({
  currentName,
  projectId,
  onClose,
  onRename,
  existingProjectNames = []
}) => {
  const { t } = useTranslation();
  const [newName, setNewName] = useState(currentName);
  const [error, setError] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const validate = (): boolean => {
    const trimmedName = newName.trim();

    if (!trimmedName) {
      setError(t('validation.nameEmpty'));
      return false;
    }

    if (trimmedName.length < 3) {
      setError(t('validation.nameMinLength'));
      return false;
    }

    if (trimmedName.length > 100) {
      setError(t('validation.nameMaxLength'));
      return false;
    }

    if (trimmedName === currentName) {
      setError(t('validation.nameUnchanged'));
      return false;
    }

    if (existingProjectNames.includes(trimmedName)) {
      setError(t('validation.nameExists'));
      return false;
    }

    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(trimmedName)) {
      setError(t('validation.nameInvalidChars'));
      return false;
    }

    return true;
  };

  const handleRename = () => {
    setError('');
    
    if (validate()) {
      onRename(projectId, newName.trim());
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRename();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-gray-600" />
            <h2 className="text-xl font-bold text-gray-900">{t('dialogs.rename.title')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">{t('dialogs.rename.currentName')}:</div>
            <div className="text-sm font-medium text-gray-900">{currentName}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('dialogs.rename.newName')} <span className="text-red-500">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setError('');
              }}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                error ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder={t('dialogs.rename.placeholder')}
            />
            
            <div className="mt-1 text-xs text-gray-500 text-right">
              {newName.length} / 100 {t('dialogs.rename.characters')}
            </div>

            {error && (
              <div className="mt-2 flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-xs text-blue-800">
              <p className="font-medium mb-1">{t('dialogs.rename.hints')}:</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                <li>{t('dialogs.rename.hint1')}</li>
                <li>{t('dialogs.rename.hint2')}</li>
                <li>{t('dialogs.rename.hint3')}</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleRename}
            disabled={!newName.trim() || newName === currentName}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              newName.trim() && newName !== currentName
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {t('dialogs.rename.renameButton')}
          </button>
        </div>

        <div className="px-6 pb-3 text-xs text-gray-500 text-center">
          {t('dialogs.rename.keyboardHint')}
        </div>
      </div>
    </div>
  );
};
