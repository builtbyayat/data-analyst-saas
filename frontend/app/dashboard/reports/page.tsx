import WorkspaceRecords from "../../../components/workspace/workspace-records";
import ReportPublishingPanel from "../../../components/reports/report-publishing-panel";

export default function ReportsPage() {
  return (
    <>
      <ReportPublishingPanel />
      <WorkspaceRecords section="reports" />
    </>
  );
}
