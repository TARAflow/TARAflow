import React from 'react';
import { PhaseStatus, ProjectStatus } from "../models/common-types";

// ==================== BADGE COMPONENT ====================

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  className = "",
}) => {
  const variantStyles = {
    default: "bg-gray-100 text-gray-800",
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    danger: "bg-red-100 text-red-800",
    info: "bg-blue-100 text-blue-800",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

// ==================== STATUS BADGE HELPERS ====================

export const PhaseStatusBadge: React.FC<{ status: PhaseStatus }> = ({
  status,
}) => {
  const variants: Record<
    PhaseStatus,
    "default" | "success" | "warning" | "danger" | "info"
  > = {
    complete: "success",
    "in-progress": "info",
    incomplete: "danger",
    "not-started": "default",
    blocked: "warning",
    unknown: "default",
  };

  const labels: Record<PhaseStatus, string> = {
    complete: "Complete",
    "in-progress": "In Progress",
    incomplete: "Incomplete",
    "not-started": "Not Started",
    blocked: "Blocked",
    unknown: "Unknown",
  };

  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
};

export const ProjectStatusBadge: React.FC<{ status: ProjectStatus }> = ({ status }) => {
  const variants: Record<ProjectStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
    'draft': 'default',
    'in-progress': 'info',
    'review': 'warning',
    'complete': 'success'
  };

  const labels: Record<ProjectStatus, string> = {
    'draft': 'Draft',
    'in-progress': 'In Progress',
    'review': 'Review',
    'complete': 'Complete'
  };

  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
};