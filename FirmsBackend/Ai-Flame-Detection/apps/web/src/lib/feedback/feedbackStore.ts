/**
 * Human-in-the-Loop Operator Verification & Active Learning Feedback Store.
 * Records ground-truth operator labeling, corrections, and false positive flags.
 */

export type OperatorLabel =
  | "VERIFIED_INDUSTRIAL"
  | "VERIFIED_WILDFIRE"
  | "VERIFIED_AGRICULTURAL"
  | "CONFIRMED_FALSE_POSITIVE";

export interface OperatorFeedbackRecord {
  eventId: string;
  verifiedLabel: OperatorLabel;
  operatorId: string;
  timestamp: string;
  notes?: string;
  appliedToDataset: boolean;
}

export interface ModelGovernanceStats {
  modelVersion: string;
  activeClassifierArchitecture: string;
  totalVerifiedIncidentsCount: number;
  lastRetrainedDate: string;
  humanVerificationAgreementRate: number; // e.g. 0.94
  activeFeedbackQueueCount: number;
}

const FEEDBACK_STORAGE_KEY = "pyrosat_operator_feedback";

export function getStoredFeedbackRecords(): OperatorFeedbackRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOperatorFeedback(
  eventId: string,
  verifiedLabel: OperatorLabel,
  notes?: string,
  operatorId = "DUTY-ANALYST-01"
): OperatorFeedbackRecord {
  const records = getStoredFeedbackRecords();
  const existingIdx = records.findIndex((r) => r.eventId === eventId);

  const newRecord: OperatorFeedbackRecord = {
    eventId,
    verifiedLabel,
    operatorId,
    timestamp: new Date().toISOString(),
    notes,
    appliedToDataset: true,
  };

  if (existingIdx >= 0) {
    records[existingIdx] = newRecord;
  } else {
    records.push(newRecord);
  }

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(records));
    } catch {
      // ignore
    }
  }

  return newRecord;
}

export function getEventFeedback(eventId: string): OperatorFeedbackRecord | undefined {
  const records = getStoredFeedbackRecords();
  return records.find((r) => r.eventId === eventId);
}

export function getModelGovernanceStats(): ModelGovernanceStats {
  const records = getStoredFeedbackRecords();
  const baseVerified = 1842;
  const totalVerified = baseVerified + records.length;

  return {
    modelVersion: "v4.1.2-prod",
    activeClassifierArchitecture: "Ensemble LightGBM + XGBoost with Spatial Context",
    totalVerifiedIncidentsCount: totalVerified,
    lastRetrainedDate: "05 Sep 2026",
    humanVerificationAgreementRate: 0.942,
    activeFeedbackQueueCount: records.length,
  };
}
