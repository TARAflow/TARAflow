// The form labels of a tracker in the UI language (review 2026-10-30): the
// descriptions in shared/models/issue-trackers.ts carry the English defaults.

import type { IssueTrackerDescriptor } from "shared/models/issue-trackers";

type Translate = (key: string, options?: Record<string, unknown>) => string;

export interface TrackerLabels {
  host: string;
  user: string;
  secret: string;
}

export function trackerLabels(tracker: IssueTrackerDescriptor, t: Translate): TrackerLabels {
  return {
    host: t(`integration.host.${tracker.id}`, { defaultValue: tracker.hostLabel }),
    user: tracker.userField
      ? t(`integration.user.${tracker.userField.kind}`, { defaultValue: tracker.userField.label })
      : t("integration.user.username", { defaultValue: "User" }),
    secret: t(`integration.secret.${tracker.id}`, { defaultValue: tracker.secretLabel }),
  };
}
