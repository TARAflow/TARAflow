import React, { useState, useRef } from 'react';
import { X, Upload, File, AlertCircle, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ==================== IMPORT PROJECT DIALOG ====================

interface ImportProjectDialogProps {
  onClose: () => void;
  onImport: (file: File, options: ImportOptions) => Promise<ImportResult>;
}

export interface ImportOptions {
  overwriteExisting: boolean;
  validateBeforeImport: boolean;
  generateNewId: boolean;
}

export interface ImportResult {
  success: boolean;
  projectId?: string;
  projectName?: string;
  errors?: string[];
  warnings?: string[];
}

type ImportStep = 'select' | 'preview' | 'importing' | 'result';

export const ImportProjectDialog: React.FC<ImportProjectDialogProps> = ({ 
  onClose, 
  onImport 
}) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState<ImportStep>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<any>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [options, setOptions] = useState<ImportOptions>({
    overwriteExisting: false,
    validateBeforeImport: true,
    generateNewId: true
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setErrors([]);

    if (!file.name.endsWith('.json')) {
      setErrors([t('dialogs.import.errorJsonOnly')]);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrors([t('dialogs.import.errorFileSize')]);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = JSON.parse(e.target?.result as string);
        setFileContent(content);
        setCurrentStep('preview');
      } catch (error) {
        setErrors([t('dialogs.import.errorInvalidJson')]);
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setCurrentStep('importing');

    try {
      const result = await onImport(selectedFile, options);
      setImportResult(result);
      setCurrentStep('result');
    } catch (error) {
      setImportResult({
        success: false,
        errors: [(error as Error).message]
      });
      setCurrentStep('result');
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {t("dialogs.import.title")}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label={t("common.close")}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Step 1: File Selection */}
          {currentStep === "select" && (
            <div className="p-6 space-y-6">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  isDragging
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <Upload
                  className={`w-16 h-16 mx-auto mb-4 ${
                    isDragging ? "text-blue-500" : "text-gray-400"
                  }`}
                />

                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {t("dialogs.import.selectFile")}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  {t("dialogs.import.dropzone")}
                </p>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t("dialogs.import.browseButton")}
                </button>

                <input
                  aria-label={t("dialogs.import.browseButton")}
                  id="import-project"
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  className="hidden"
                />
              </div>

              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-red-800 mb-1">
                        {t("dialogs.import.errorTitle")}
                      </h4>
                      <ul className="text-sm text-red-700 space-y-1">
                        {errors.map((error, idx) => (
                          <li key={idx}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">
                      {t("dialogs.import.infoTitle")}
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-blue-700">
                      <li>{t("dialogs.import.infoItem1")}</li>
                      <li>{t("dialogs.import.infoItem2")}</li>
                      <li>{t("dialogs.import.infoItem3")}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {currentStep === "preview" && fileContent && (
            <div className="p-6 space-y-6">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <File className="w-8 h-8 text-blue-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">
                      {selectedFile?.name}
                    </h3>
                    <div className="text-sm text-gray-600 mt-1 space-y-1">
                      <div>
                        {t("dialogs.import.fileSize")}:{" "}
                        {((selectedFile?.size || 0) / 1024).toFixed(1)} KB
                      </div>
                      <div>
                        {t("project.title")}:{" "}
                        <span className="font-medium">
                          {fileContent.name || t("common.unknown")}
                        </span>
                      </div>
                      {fileContent.version && (
                        <div>
                          {t("project.version")}: {fileContent.version}
                        </div>
                      )}
                      {fileContent.created && (
                        <div>
                          {t("project.created")}:{" "}
                          {new Date(fileContent.created).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {t("dialogs.import.preview")}
                </h3>
                <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                  <div>
                    <span className="text-sm text-gray-600">
                      {t("project.name")}:
                    </span>
                    <span className="ml-2 font-medium text-gray-900">
                      {fileContent.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">
                      {t("project.description")}:
                    </span>
                    <p className="text-sm text-gray-900 mt-1">
                      {fileContent.description}
                    </p>
                  </div>
                  {fileContent.responsible && (
                    <div>
                      <span className="text-sm text-gray-600">
                        {t("project.responsible")}:
                      </span>
                      <span className="ml-2 text-sm text-gray-900">
                        {fileContent.responsible}
                      </span>
                    </div>
                  )}
                  {fileContent.tags && fileContent.tags.length > 0 && (
                    <div>
                      <span className="text-sm text-gray-600 block mb-2">
                        {t("project.tags")}:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {fileContent.tags.map((tag: string, idx: number) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {t("dialogs.import.options")}
                </h3>
                <div className="space-y-3">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={options.generateNewId}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          generateNewId: e.target.checked,
                        })
                      }
                      className="w-4 h-4 mt-0.5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {t("dialogs.import.optionNewId")}
                      </div>
                      <div className="text-xs text-gray-600">
                        {t("dialogs.import.optionNewIdDesc")}
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={options.validateBeforeImport}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          validateBeforeImport: e.target.checked,
                        })
                      }
                      className="w-4 h-4 mt-0.5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {t("dialogs.import.optionValidate")}
                      </div>
                      <div className="text-xs text-gray-600">
                        {t("dialogs.import.optionValidateDesc")}
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Importing */}
          {currentStep === "importing" && (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t("dialogs.import.importing")}
              </h3>
              <p className="text-sm text-gray-600">
                {t("dialogs.import.pleaseWait")}
              </p>
            </div>
          )}

          {/* Step 4: Result */}
          {currentStep === "result" && importResult && (
            <div className="p-6">
              {importResult.success ? (
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {t("dialogs.import.success")}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {t("dialogs.import.successMessage", {
                      name: importResult.projectName,
                    })}
                  </p>

                  {importResult.warnings &&
                    importResult.warnings.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left mb-6">
                        <h4 className="text-sm font-medium text-yellow-800 mb-2">
                          {t("dialogs.import.warnings")}:
                        </h4>
                        <ul className="text-sm text-yellow-700 space-y-1">
                          {importResult.warnings.map((warning, idx) => (
                            <li key={idx}>• {warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              ) : (
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                    <AlertCircle className="w-10 h-10 text-red-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {t("dialogs.import.failed")}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {t("dialogs.import.failedMessage")}
                  </p>

                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left">
                      <h4 className="text-sm font-medium text-red-800 mb-2">
                        {t("dialogs.import.errors")}:
                      </h4>
                      <ul className="text-sm text-red-700 space-y-1">
                        {importResult.errors.map((error, idx) => (
                          <li key={idx}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end bg-white">
          {currentStep === "select" && (
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium"
            >
              {t("common.cancel")}
            </button>
          )}

          {currentStep === "preview" && (
            <>
              <button
                onClick={() => setCurrentStep("select")}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium"
              >
                {t("common.back")}
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                {t("common.import")}
              </button>
            </>
          )}

          {currentStep === "result" && (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              {importResult?.success
                ? t("dialogs.import.goToProject")
                : t("common.close")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
