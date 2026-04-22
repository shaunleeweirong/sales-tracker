import { getUserAndProfile } from "@/lib/auth";
import { CsvUploader } from "./csv-uploader";

export default async function ImportPage() {
  await getUserAndProfile();
  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Import weekly spend (CSV or Excel)</h1>
        <p className="text-sm text-muted-foreground">
          Expected columns: <span className="font-mono">Parent Company</span>,{" "}
          <span className="font-mono">Child Company</span>,{" "}
          <span className="font-mono">LinkedIn Ad Account ID</span>,{" "}
          <span className="font-mono">Last 7 Days Spend</span>,{" "}
          <span className="font-mono">QTD Spend</span>.
        </p>
      </div>
      <CsvUploader />
    </div>
  );
}
