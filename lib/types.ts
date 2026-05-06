// === Existing types (PM Web all-data + K-Fasts trans) ============================

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
  isTotalRow: boolean;
  isSummaryTask: boolean;
  taskCode: string | null;
  taskName: string;
};

export type TransRow = {
  wbs2: string;
  taskName: string;
  transDate: string;
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
  period: string | null;
  postSeq: number | null;
  isLabor: boolean;
};

// === Project / detection ==========================================================

export type ProjectMeta = {
  id: string;
  name: string;
  shortName: string;
  pmName: string;
  startDate: string | null;
  estCompDate: string | null;
  uploadedAt: string;
  /** Tracks which CSVs have been uploaded for the project. */
  uploaded: Partial<Record<CsvKind, boolean>>;
};

export type CsvKind =
  | "all-data"
  | "trans"
  | "invoice-summary"
  | "task-summary"
  | "task-budget"
  | "etc"
  | "invoice-log"
  | "change-log"
  | "sub-management"
  | "staff"
  | "notes"
  | "check-detail"
  | "tables";

export type DetectionResult = {
  kind: CsvKind | "unknown";
  /** Row index (0-based) of the header row, where applicable. */
  headerRowIndex: number | null;
  /** Human label shown in the upload dialog. */
  label: string;
};

// === Per-tab row types ============================================================

export type InvoiceSummaryRow = {
  task: string;            // "01"
  taskDescription: string; // "TASK 1-DATA COLLECTION/FIELD INVEST"
  totalFee: number;
  estCurrentInvoice: number;
  cumInvoiceToDate: number;
  jtdRevenue: number;
  estimateAtComplete: number;
  pctSpent: number;
  pctComp: number;
  paidToDate: number;
  arOver60: number;
  nrm: number;
};

export type TaskSummaryRow = {
  sumTask: string;
  taskNo: string;          // typically empty for sum-task rows; populated for sub-task export shape
  taskDescription: string;
  laborFee: number;
  reimbursableFee: number;
  labFee: number;
  subFee: number;
  changeOrderAmt: number;
  totalFee: number;
  jtdRevenue: number;
  feeRemaining: number;
  pctComplete: number;
  estimateToComp: number;
  estimateAtComp: number;
  variance: number;
  pctSpent: number;
  startDate: string | null;
  endDate: string | null;
};

export type TaskBudgetRow = TaskSummaryRow & {
  /** True if this is a parent summary task (XX-0000) - used as section header. */
  isSummaryHeader: boolean;
};

export type ETCRow = {
  sumTask: string;
  filter: string;
  task: string;            // sub-task code "01-1000"
  taskDescription: string;
  staff: string;
  discipline: string;
  type: string;
  billingRate: number;
  budgetHrs: number;
  actualsHrs: number;
  etcHrs: number;
  pctSpent: number;
  budgetCost: number;
  actualCost: number;
  etcCost: number;
  eacCost: number;
  vac: number;
};

export type InvoiceLogRow = {
  firm: string;
  ntpDate: string | null;
  budget: number;
  remainingBudget: number;
  cumInvoice: number;
  pctSpent: number;
  /** Each period column header (ISO date string for first of month) → invoice amount. */
  byPeriod: Record<string, number>;
};

export type InvoiceLogPeriod = {
  /** First-of-month ISO date string */
  date: string;
  /** Friendly label for column */
  label: string;
};

export type ChangeLogRow = {
  changeNo: string;
  description: string;
  leadContact: string;
  estimatedCost: number;
  estDaysDelay: number;
  status: string;
  submittedDate: string | null;
  approvedDate: string | null;
};

export type SubRow = {
  firm: string;
  firmName: string;
  oriFee: number;
  mods: number;
  approvedFee: number;
  invoicedToDate: number;
  remaining: number;
};

export type SubModRow = {
  firm: string;
  oriFee: number;
  mod01: number;
  approvedDate: string | null;
};

export type StaffRow = {
  firm: string;
  type: string;
  discipline: string;
  name: string;
  title: string;
  fy25Rate: number;
  fy26Rate: number;
};

/** Notes is a structured key→value map plus free-form text. */
export type NotesData = {
  fields: Record<string, string>;
  freeform: string;
};

export type CheckDetailRow = {
  wbs2: string;
  taskName: string;
  empVenUnitName: string;
  hrsQty: number;
  billAmt: number;
  /** True if this is a per-task subtotal row from the source pivot. */
  isSubtotal: boolean;
};

export type PeriodRow = {
  /** "202506" */
  billedPeriod: string;
  month: string;
  year: string;
  /** ISO first-of-month */
  date: string | null;
};

export type TaskRow = {
  taskNo: string;
  taskDescription: string;
  taskNoDescription: string;
  summaryTask: string;
};

export type SumTaskRow = {
  sumTask: string;
  summaryDescription: string;
  summaryNoDescriptions: string;
};

export type TablesData = {
  periods: PeriodRow[];
  tasks: TaskRow[];
  sumTasks: SumTaskRow[];
};

/** Project multiplier may be embedded in the staff CSV header. */
export type StaffData = {
  rows: StaffRow[];
  projectMultiplier: number | null;
};

export type SubManagementData = {
  subs: SubRow[];
  mods: SubModRow[];
};

export type InvoiceLogData = {
  rows: InvoiceLogRow[];
  periods: InvoiceLogPeriod[];
};
