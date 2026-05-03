export type AllDataRow = {
  projectNumberName: string;
  taskNumberName: string;
  poNumber: string | null;
  pmName: string | null;
  segment: string | null;
  billingClient: string | null;
  owner: string | null;
  projectType: string | null;
  laborFee: number;
  consultFee: number;
  reimbFee: number;
  totalFee: number;
  remainingTotalFee: number;
  remainingLaborFee: number;
  pctRevenueTaken: number;
  jtdHours: number;
  mtdHours: number;
  lastWeekHrs: number;
  laborRev: number;
  subsRev: number;
  reimbRev: number;
  otherRev: number;
  grossRev: number;
  netRev: number;
  laborCost: number;
  ohCost: number;
  subsCost: number;
  reimbCost: number;
  totalCost: number;
  billedLabor: number;
  billedSubs: number;
  billedReimb: number;
  billedTotal: number;
  receivedAmount: number;
  arAmnt: number;
  totalUnbilled: number;
  targetMultiplierJtd: number | null;
  multiplierJtd: number | null;
  targetMultiplierMtd: number | null;
  multiplierMtd: number | null;
  multiplierTtm: number | null;
  profitPct: number;
  gmPct: number;
  status: string | null;
  startDate: string | null; // ISO
  estCompDate: string | null;
  laborBacklog: number;
  billType: string | null;
  /** True if this row is the project-level rollup (Task Number & Name === "Total") */
  isTotalRow: boolean;
  /** True if this is a high-level summary task (e.g. "01-0000 ...") */
  isSummaryTask: boolean;
  /** Parsed task code, e.g. "01-1000" */
  taskCode: string | null;
  /** Pretty task name without the leading code */
  taskName: string;
};

export type TransRow = {
  wbs2: string; // task code
  taskName: string;
  transDate: string; // ISO date
  empVenUnitName: string;
  hrsQty: number;
  nlCost: number;
  rate: number;
  billAmt: number;
  activity: string | null;
  billTitle: string | null;
  invDescription: string | null;
  category: string | null;
  transType: string | null;
  billStatus: string | null;
  billedInvoice: string | null;
  commentDesc: string | null;
  period: string | null; // e.g. "202609"
  postSeq: number | null;
  /** Derived: is this a labor row (Category starts with L-)? */
  isLabor: boolean;
};

export type ProjectMeta = {
  id: string; // project number e.g. "26003153.001A"
  name: string; // full from PM Web
  shortName: string; // friendly trailing portion
  pmName: string;
  startDate: string | null;
  estCompDate: string | null;
  uploadedAt: string;
  /** Which files have been uploaded for this project */
  hasAllData: boolean;
  hasTrans: boolean;
};

export type DetectionKind = "all-data" | "trans" | "unknown";

export type DetectionResult = {
  kind: DetectionKind;
  /** Sheet name selected from the workbook */
  sheetName: string | null;
  /** For trans files: the row index (0-based) where machine headers live */
  headerRowIndex: number | null;
  /** Reason / human label for what we found */
  label: string;
};
