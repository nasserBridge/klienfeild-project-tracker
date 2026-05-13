"use client";
import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, AlertTriangle, ChevronDown } from "lucide-react";
import { fmtDateTime } from "@/lib/utils";
import { SummaryTab } from "@/components/tabs/summary-tab";
import { TaskBudgetTab } from "@/components/tabs/task-budget-tab";
import { HoursByStaffTab } from "@/components/tabs/hours-by-staff-tab";
import { HoursByTaskTab } from "@/components/tabs/hours-by-task-tab";
import { RevenueByPeriodTab } from "@/components/tabs/revenue-by-period-tab";
import { TransactionsTab } from "@/components/tabs/transactions-tab";
import { TaskSummaryTab } from "@/components/tabs/task-summary-tab";
import { ETCTab } from "@/components/tabs/etc-tab";
import { InvoiceSummaryTab } from "@/components/tabs/invoice-summary-tab";
import { InvoiceLogTab } from "@/components/tabs/invoice-log-tab";
import { SubManagementTab } from "@/components/tabs/sub-management-tab";
import { StaffTab } from "@/components/tabs/staff-tab";
import { ChangeLogTab } from "@/components/tabs/change-log-tab";
import { NotesTab } from "@/components/tabs/notes-tab";
import { CheckDetailTab } from "@/components/tabs/check-detail-tab";
import { UploadDialog } from "@/components/upload-dialog";
import { exportProjectToZip } from "@/lib/export";
import {
  exportAllTabsToXlsx,
  exportTabToXlsx,
  TAB_LABELS,
  type TabKey,
} from "@/lib/xlsx-export";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deriveCheckDetail,
  deriveEtc,
  deriveInvoiceLog,
  deriveInvoiceSummary,
  deriveTables,
  deriveTaskBudget,
  deriveTaskSummary,
} from "@/lib/calculations";
import type {
  AllDataRow,
  ChangeLogRow,
  CheckDetailRow,
  ETCRow,
  InvoiceLogData,
  InvoiceSummaryRow,
  NotesData,
  StaffData,
  SubManagementData,
  TablesData,
  TaskBudgetRow,
  TaskSummaryRow,
  TransRow,
} from "@/lib/types";

export function ProjectShell({ projectId }: { projectId: string }) {
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<TabKey>("summary");

  const project = useLiveQuery(
    async () => {
      if (typeof window === "undefined") return null;
      return (await db().projects.get(projectId)) ?? null;
    },
    [projectId],
  );

  // Sources from the master tracker XLSX (or its components)
  const allDataR = useDexieGet<{ projectId: string; rows: AllDataRow[] }>("allDataExport", projectId);
  const transR = useDexieGet<{ projectId: string; rows: TransRow[] }>("projTransDetail", projectId);
  const invoiceSummaryR = useDexieGet<{ projectId: string; rows: InvoiceSummaryRow[] }>("invoiceSummary", projectId);
  const taskSummaryR = useDexieGet<{ projectId: string; rows: TaskSummaryRow[] }>("taskSummary", projectId);
  const taskBudgetR = useDexieGet<{ projectId: string; rows: TaskBudgetRow[] }>("taskBudget", projectId);
  const invoiceLogR = useDexieGet<{ projectId: string; data: InvoiceLogData }>("invoiceLog", projectId);
  const changeLogR = useDexieGet<{ projectId: string; rows: ChangeLogRow[] }>("changeLog", projectId);
  const subManagementR = useDexieGet<{ projectId: string; data: SubManagementData }>("subManagement", projectId);
  const staffR = useDexieGet<{ projectId: string; data: StaffData }>("staff", projectId);
  const etcR = useDexieGet<{ projectId: string; rows: ETCRow[] }>("etc", projectId);
  const notesR = useDexieGet<{ projectId: string; data: NotesData }>("notes", projectId);
  const checkDetailR = useDexieGet<{ projectId: string; rows: CheckDetailRow[] }>("checkDetail", projectId);
  const tablesR = useDexieGet<{ projectId: string; data: TablesData }>("lookupTables", projectId);

  const stillLoading =
    project === undefined ||
    allDataR === undefined ||
    transR === undefined ||
    invoiceSummaryR === undefined ||
    taskSummaryR === undefined ||
    taskBudgetR === undefined ||
    invoiceLogR === undefined ||
    changeLogR === undefined ||
    subManagementR === undefined ||
    staffR === undefined ||
    etcR === undefined ||
    notesR === undefined ||
    checkDetailR === undefined ||
    tablesR === undefined;

  // ---- IMPORTANT ----
  // All hooks (including useMemo) MUST be called every render, in the same order.
  // Compute derived data using fall-back-empty arrays so the hooks run even
  // before queries resolve, and bail to the loading UI *after* hooks have run.
  const allData = allDataR?.rows ?? [];
  const trans = transR?.rows ?? [];
  const invoiceLog = invoiceLogR?.data ?? null;
  const changeLogRows = changeLogR?.rows ?? [];
  const subManagement = subManagementR?.data ?? null;
  const staff = staffR?.data ?? null;
  const etcRows = etcR?.rows ?? [];
  const notes = notesR?.data ?? null;

  // Prefer uploaded data when present; fall back to derivation from PM Web + K-Fasts
  // so every tab lights up even if the user dropped only the source exports.
  // Each derivation is wrapped in try/catch — a single bad row in IndexedDB
  // shouldn't bring down the whole project page.
  const safeDerive = <T,>(fn: () => T, fallback: T, label: string): T => {
    try {
      return fn();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[derive ${label}] failed`, err);
      return fallback;
    }
  };
  const derivedTaskSummary = React.useMemo(
    () => safeDerive(() => deriveTaskSummary(allData), [], "taskSummary"),
    [allData],
  );
  const derivedTaskBudget = React.useMemo(
    () => safeDerive(() => deriveTaskBudget(allData), [], "taskBudget"),
    [allData],
  );
  const derivedInvoiceSummary = React.useMemo(
    () => safeDerive(() => deriveInvoiceSummary(allData), [], "invoiceSummary"),
    [allData],
  );
  const derivedCheckDetail = React.useMemo(
    () => safeDerive(() => deriveCheckDetail(trans), [], "checkDetail"),
    [trans],
  );
  const derivedTables = React.useMemo(
    () =>
      safeDerive(
        () => deriveTables(allData, trans),
        { periods: [], tasks: [], sumTasks: [] } as TablesData,
        "tables",
      ),
    [allData, trans],
  );
  const derivedEtc = React.useMemo(
    () => safeDerive(() => deriveEtc(trans, allData, staff), [], "etc"),
    [trans, allData, staff],
  );
  const derivedInvoiceLog = React.useMemo(
    () =>
      safeDerive(
        () => deriveInvoiceLog(trans, allData),
        { rows: [], periods: [] } as InvoiceLogData,
        "invoiceLog",
      ),
    [trans, allData],
  );

  const taskSummary = taskSummaryR?.rows?.length ? taskSummaryR.rows : derivedTaskSummary;
  const taskBudget = taskBudgetR?.rows?.length ? taskBudgetR.rows : derivedTaskBudget;
  const invoiceSummary = invoiceSummaryR?.rows?.length ? invoiceSummaryR.rows : derivedInvoiceSummary;
  const checkDetail = checkDetailR?.rows?.length ? checkDetailR.rows : derivedCheckDetail;
  const tables = tablesR?.data ?? derivedTables;
  // ETC and Invoice Log fall back to derivation when nothing has been saved
  // for this project yet. Once the user edits in-app or uploads explicit data,
  // those edits are persisted and used directly.
  const effectiveEtc = etcRows.length > 0 ? etcRows : derivedEtc;
  const effectiveInvoiceLog =
    invoiceLog && (invoiceLog.rows.length > 0 || invoiceLog.periods.length > 0)
      ? invoiceLog
      : derivedInvoiceLog;

  if (stillLoading) {
    return <div className="p-8 text-sm text-muted">Loading project…</div>;
  }
  if (!project) {
    return (
      <div className="p-8">
        <div className="serif text-2xl mb-2">Project not found</div>
        <div className="text-sm text-muted">
          The project <span className="tabular">{projectId}</span> isn't in your local data. Add it
          from the sidebar.
        </div>
      </div>
    );
  }

  const missing: string[] = [];
  if (!project.uploaded?.["all-data"]) missing.push("PM Web All-Data");
  if (!project.uploaded?.trans) missing.push("K-Fasts Trans Detail");

  const bundle = {
    meta: project,
    allData,
    trans,
    invoiceSummary,
    taskSummary,
    taskBudget,
    etc: effectiveEtc,
    invoiceLog: effectiveInvoiceLog,
    changeLog: changeLogRows,
    subManagement,
    staff,
    notes,
    checkDetail,
    tables,
  };

  const onExportZip = async () => {
    await exportProjectToZip(bundle);
  };
  const onExportAllXlsx = () => {
    exportAllTabsToXlsx(bundle);
  };
  const onExportTabXlsx = () => {
    const ok = exportTabToXlsx(activeTab, bundle);
    if (!ok) {
      alert(`No data on the ${TAB_LABELS[activeTab]} tab to export yet.`);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="h-16 border-b border-line px-6 flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="serif text-xl truncate">{project.shortName || project.name}</div>
            <div className="tabular text-xs text-muted">{project.id}</div>
          </div>
          <div className="text-[11px] text-muted mt-0.5">
            Last updated {fmtDateTime(project.uploadedAt)}
            {project.pmName ? ` · PM ${project.pmName}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
            <RefreshCw size={14} /> Upload data
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm">
                <Download size={14} /> Export <ChevronDown size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onExportTabXlsx}>
                Export “{TAB_LABELS[activeTab]}” as XLSX
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportAllXlsx}>
                Export all tabs as XLSX
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onExportZip}>Export all as CSV (ZIP)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {missing.length > 0 && (
        <div className="flex items-center gap-2.5 px-6 py-2.5 bg-[rgba(176,112,32,0.07)] border-b border-[rgba(176,112,32,0.2)] text-[13px] text-warn">
          <AlertTriangle size={14} className="shrink-0" />
          <span>
            Missing: {missing.join(", ")}.{" "}
            <button onClick={() => setUploadOpen(true)} className="underline hover:no-underline">
              Add files
            </button>
          </span>
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabKey)}
        className="flex-1 min-h-0 flex flex-col"
      >
        <div className="overflow-x-auto border-b border-line">
          <TabsList className="border-b-0 inline-flex w-max">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="task-summary">Task Summary</TabsTrigger>
            <TabsTrigger value="task-budget">Task Budget</TabsTrigger>
            <TabsTrigger value="etc">ETC</TabsTrigger>
            <TabsTrigger value="invoice-summary">Invoice Summary</TabsTrigger>
            <TabsTrigger value="invoice-log">Invoice Log</TabsTrigger>
            <TabsTrigger value="hours-staff">Hours by Staff</TabsTrigger>
            <TabsTrigger value="hours-task">Hours by Task</TabsTrigger>
            <TabsTrigger value="revenue">Revenue by Period</TabsTrigger>
            <TabsTrigger value="sub-management">Sub Management</TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="change-log">Change Log</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="check-detail">Check Detail</TabsTrigger>
          </TabsList>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <TabsContent value="summary">
            <SummaryTab allData={allData} trans={trans} etc={effectiveEtc} />
          </TabsContent>
          <TabsContent value="task-summary">
            <TaskSummaryTab rows={taskSummary} />
          </TabsContent>
          <TabsContent value="task-budget">
            <TaskBudgetTab allData={allData} trans={trans} taskBudgetRows={taskBudget} />
          </TabsContent>
          <TabsContent value="etc">
            <ETCTab projectId={projectId} rows={effectiveEtc} trans={trans} allData={allData} staff={staff} />
          </TabsContent>
          <TabsContent value="invoice-summary">
            <InvoiceSummaryTab rows={invoiceSummary} />
          </TabsContent>
          <TabsContent value="invoice-log">
            <InvoiceLogTab projectId={projectId} data={effectiveInvoiceLog} />
          </TabsContent>
          <TabsContent value="hours-staff">
            <HoursByStaffTab allData={allData} trans={trans} />
          </TabsContent>
          <TabsContent value="hours-task">
            <HoursByTaskTab trans={trans} />
          </TabsContent>
          <TabsContent value="revenue">
            <RevenueByPeriodTab trans={trans} tables={tables} />
          </TabsContent>
          <TabsContent value="sub-management">
            <SubManagementTab projectId={projectId} data={subManagement} />
          </TabsContent>
          <TabsContent value="staff">
            <StaffTab projectId={projectId} data={staff} trans={trans} />
          </TabsContent>
          <TabsContent value="change-log">
            <ChangeLogTab projectId={projectId} rows={changeLogRows} />
          </TabsContent>
          <TabsContent value="notes">
            <NotesTab projectId={projectId} data={notes} />
          </TabsContent>
          <TabsContent value="transactions">
            <TransactionsTab trans={trans} />
          </TabsContent>
          <TabsContent value="check-detail">
            <CheckDetailTab rows={checkDetail} />
          </TabsContent>
        </div>
      </Tabs>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}

function useDexieGet<T>(table: string, projectId: string): T | null | undefined {
  return useLiveQuery(
    async (): Promise<T | null> => {
      if (typeof window === "undefined") return null;
      try {
        const t = (db() as unknown as Record<string, { get?: (k: string) => Promise<T | undefined> }>)[table];
        if (!t || typeof t.get !== "function") return null;
        return ((await t.get(projectId)) ?? null) as T | null;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[useDexieGet ${table}] failed`, err);
        return null;
      }
    },
    [table, projectId],
  );
}
