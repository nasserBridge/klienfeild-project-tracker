"use client";
import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";
import { fmtDateTime } from "@/lib/utils";
import { SummaryTab } from "@/components/tabs/summary-tab";
import { TaskBudgetTab } from "@/components/tabs/task-budget-tab";
import { HoursByStaffTab } from "@/components/tabs/hours-by-staff-tab";
import { HoursByTaskTab } from "@/components/tabs/hours-by-task-tab";
import { RevenueByPeriodTab } from "@/components/tabs/revenue-by-period-tab";
import { TransactionsTab } from "@/components/tabs/transactions-tab";
import { UploadDialog } from "@/components/upload-dialog";
import { exportProjectToXlsx } from "@/lib/export";

export function ProjectShell({ projectId }: { projectId: string }) {
  const [uploadOpen, setUploadOpen] = React.useState(false);

  // Use `?? null` so useLiveQuery's undefined-while-loading is distinguishable from
  // "record not found" (which would also come back as undefined without this).
  const project = useLiveQuery(
    async () => (await db().projects.get(projectId)) ?? null,
    [projectId],
  );
  const allData = useLiveQuery(
    async () => (await db().allDataExport.get(projectId)) ?? null,
    [projectId],
  );
  const trans = useLiveQuery(
    async () => (await db().projTransDetail.get(projectId)) ?? null,
    [projectId],
  );

  // undefined = query still in flight; null = resolved but not found
  if (project === undefined || allData === undefined || trans === undefined) {
    return <div className="p-8 text-sm text-muted">Loading project…</div>;
  }
  if (!project) {
    return (
      <div className="p-8">
        <div className="serif text-2xl mb-2">Project not found</div>
        <div className="text-sm text-muted">
          The project <span className="tabular">{projectId}</span> isn't in your local data. Add it from the sidebar.
        </div>
      </div>
    );
  }

  const allDataRows = allData?.rows ?? [];
  const transRows = trans?.rows ?? [];

  const onExport = async () => {
    await exportProjectToXlsx(project, allDataRows, transRows);
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
            <RefreshCw size={14} /> Refresh data
          </Button>
          <Button variant="default" size="sm" onClick={onExport}>
            <Download size={14} /> Export to Excel
          </Button>
        </div>
      </header>

      <Tabs defaultValue="summary" className="flex-1 min-h-0 flex flex-col">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="task-budget">Task Budget</TabsTrigger>
          <TabsTrigger value="hours-staff">Hours by Staff</TabsTrigger>
          <TabsTrigger value="hours-task">Hours by Task</TabsTrigger>
          <TabsTrigger value="revenue">Revenue by Period</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <TabsContent value="summary">
            <SummaryTab allData={allDataRows} trans={transRows} />
          </TabsContent>
          <TabsContent value="task-budget">
            <TaskBudgetTab allData={allDataRows} trans={transRows} />
          </TabsContent>
          <TabsContent value="hours-staff">
            <HoursByStaffTab allData={allDataRows} trans={transRows} />
          </TabsContent>
          <TabsContent value="hours-task">
            <HoursByTaskTab trans={transRows} />
          </TabsContent>
          <TabsContent value="revenue">
            <RevenueByPeriodTab trans={transRows} />
          </TabsContent>
          <TabsContent value="transactions">
            <TransactionsTab trans={transRows} />
          </TabsContent>
        </div>
      </Tabs>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}
