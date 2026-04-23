import { getUserAndProfile } from "@/lib/auth";
import { OppUploader } from "./opp-uploader";

export default async function ImportOpportunitiesPage() {
  await getUserAndProfile();
  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Import opportunities (CSV or Excel)</h1>
        <p className="text-sm text-muted-foreground">
          Required columns: <span className="font-mono">Name</span>,{" "}
          <span className="font-mono">LinkedIn Ad Account ID</span>,{" "}
          <span className="font-mono">Probability %</span>. Optional:{" "}
          <span className="font-mono">Forecasted Pipeline</span>,{" "}
          <span className="font-mono">Expected Close Date</span>,{" "}
          <span className="font-mono">Owner</span>,{" "}
          <span className="font-mono">Team</span>, and notes fields. Ad accounts must already exist —
          import spend first.
        </p>
      </div>
      <OppUploader />
    </div>
  );
}
