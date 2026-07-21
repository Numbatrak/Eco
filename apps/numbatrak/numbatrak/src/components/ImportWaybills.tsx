import { useState } from "react";
import { useOrganization } from "../contexts/OrganizationContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { importWaybillData } from "../utils/importWaybills";
import { Alert, AlertDescription } from "./ui/alert";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export function ImportWaybills() {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: number;
    errors: number;
    errorsList: string[];
  } | null>(null);

  const handleImport = async () => {
    if (!data.trim()) {
      alert("Please paste the waybill data");
      return;
    }
    if (!currentOrganization) {
      alert("Select an organization before importing");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const importResult = await importWaybillData(currentOrganization.id, data);
      setResult(importResult);
    } catch (err) {
      console.error("Import error:", err);
      setResult({
        success: 0,
        errors: 1,
        errorsList: [err instanceof Error ? err.message : "Unknown error"],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Import Waybill Data</CardTitle>
          <CardDescription>
            Paste the waybill data (tab-separated) to import into the database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="waybill-data">Waybill Data (Tab-separated)</Label>
            <Textarea
              id="waybill-data"
              value={data}
              onChange={(e) => setData(e.target.value)}
              placeholder="Paste your waybill data here..."
              className="min-h-[400px] font-mono text-sm"
            />
          </div>

          <Button
            onClick={handleImport}
            disabled={loading || !data.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              "Import Data"
            )}
          </Button>

          {result && (
            <div className="space-y-2">
              <Alert
                className={
                  result.errors === 0
                    ? "border-green-200 bg-green-50"
                    : result.success > 0
                    ? "border-yellow-200 bg-yellow-50"
                    : "border-red-200 bg-red-50"
                }
              >
                <div className="flex items-center gap-2">
                  {result.errors === 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-yellow-600" />
                  )}
                  <AlertDescription>
                    <div className="font-semibold">
                      Import Complete: {result.success} successful, {result.errors} errors
                    </div>
                  </AlertDescription>
                </div>
              </Alert>

              {result.errorsList.length > 0 && (
                <div className="max-h-60 overflow-y-auto border rounded-md p-4 bg-gray-50">
                  <div className="text-sm font-semibold mb-2">Errors:</div>
                  <ul className="text-sm space-y-1">
                    {result.errorsList.slice(0, 20).map((error, idx) => (
                      <li key={idx} className="text-red-600">
                        {error}
                      </li>
                    ))}
                    {result.errorsList.length > 20 && (
                      <li className="text-gray-500">
                        ... and {result.errorsList.length - 20} more errors
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}









