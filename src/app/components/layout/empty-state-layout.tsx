import React from 'react';
import { Button } from "shared";

// ==================== EMPTY STATE ====================

interface EmptyStateProps {
  onOpenProject: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onOpenProject }) => {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">No Project Open</h2>
        <p className="text-gray-600 mb-4">Open a project from the sidebar or create a new one</p>
        <Button onClick={onOpenProject}>
          Open Project
        </Button>
      </div>
    </div>
  );
};