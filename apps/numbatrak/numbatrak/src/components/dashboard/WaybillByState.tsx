import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { fetchWaybillsByState, WaybillByState } from "../../services/waybillsByState";
import { useOrganization } from "../../contexts/OrganizationContext";
import { nigeriaStates } from "../../constants/nigeriaStates";
import { TrendingUp, Package, Calendar, MapPin } from "lucide-react";
import { LottieLoader } from "../ui/LottieLoader";

export function WaybillByStateComponent() {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<WaybillByState[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    loadData();
  }, [selectedState, startDate, endDate, currentOrganization?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await fetchWaybillsByState(
        currentOrganization?.id ?? null,
        startDate || undefined,
        endDate || undefined,
        selectedState === "all" ? undefined : selectedState
      );
      setData(result);
    } catch (err) {
      console.error("Error loading waybill statistics:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getTimeFrame = (earliest: string | null, latest: string | null) => {
    if (!earliest || !latest) return "N/A";
    return `${formatDate(earliest)} - ${formatDate(latest)}`;
  };

  // Calculate summary stats
  const totalQuantity = data.reduce((sum, item) => sum + item.totalQuantity, 0);
  const totalCost = data.reduce((sum, item) => sum + item.totalCost, 0);
  const totalWaybills = data.reduce((sum, item) => sum + item.waybillCount, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Waybill Statistics by State
            </CardTitle>
            <CardDescription>
              Track waybilled items from Lagos warehouse to other states
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <Label htmlFor="state-filter">State/Region</Label>
            <Select value={selectedState} onValueChange={setSelectedState}>
              <SelectTrigger id="state-filter">
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {nigeriaStates
                  .filter((state) => state !== "Lagos")
                  .map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="end-date">End Date</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setSelectedState("all");
              }}
              className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg border border-primary/25 bg-primary/5 p-4">
            <div className="mb-1 flex items-center gap-2 text-primary">
              <Package className="h-4 w-4" />
              <span className="text-sm font-medium">Total Quantity</span>
            </div>
            <div className="font-metric text-2xl font-bold text-foreground">
              {totalQuantity.toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg border border-primary/25 bg-primary/5 p-4">
            <div className="mb-1 flex items-center gap-2 text-primary">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">Total Waybills</span>
            </div>
            <div className="font-metric text-2xl font-bold text-foreground">
              {totalWaybills.toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <div className="mb-1 flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-medium">Total Value</span>
            </div>
            <div className="font-metric text-2xl font-bold text-foreground">
              {formatCurrency(totalCost)}
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-8">
            <LottieLoader size={80} />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No waybill data found for the selected filters.
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>State/Region</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Waybill Count</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead>Time Frame</TableHead>
                  <TableHead className="text-right">
                    Avg. Days Since Waybill
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item, index) => (
                  <TableRow key={item.state}>
                    <TableCell className="text-gray-500">{index + 1}</TableCell>
                    <TableCell className="font-medium">{item.state}</TableCell>
                    <TableCell className="text-right">
                      {item.totalQuantity.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.waybillCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.totalCost)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {getTimeFrame(item.earliestDate, item.latestDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.averageDaysSinceWaybill !== null
                        ? `${item.averageDaysSinceWaybill} days`
                        : "N/A"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
