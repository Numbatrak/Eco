import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { BRAND_CHART } from "../brand/tokens";

const axisProps = {
  stroke: BRAND_CHART.coolGray,
  tick: { fill: BRAND_CHART.coolGray, fontSize: 11, fontFamily: "DM Mono, monospace" },
};
const gridStroke = "#334155";

const weeklyDeliveryData = [
  { day: "Mon", rate: 92 },
  { day: "Tue", rate: 88 },
  { day: "Wed", rate: 94 },
  { day: "Thu", rate: 90 },
  { day: "Fri", rate: 85 },
  { day: "Sat", rate: 87 },
  { day: "Sun", rate: 91 },
];

const slaBreachData = [
  { name: "Lagos-1", breaches: 12 },
  { name: "Lagos-2", breaches: 8 },
  { name: "Abuja-1", breaches: 15 },
  { name: "PH-1", breaches: 6 },
  { name: "Ibadan", breaches: 10 },
  { name: "Kano", breaches: 5 },
];

const inventoryTrendData = [
  { week: "W1", stock: 450 },
  { week: "W2", stock: 420 },
  { week: "W3", stock: 380 },
  { week: "W4", stock: 340 },
  { week: "W5", stock: 310 },
  { week: "W6", stock: 280 },
];

const remittanceAgingData = [
  { name: "0-7 days", value: 45, color: BRAND_CHART.emerald },
  { name: "8-14 days", value: 30, color: BRAND_CHART.softEmerald },
  { name: "15-30 days", value: 15, color: BRAND_CHART.coolGray },
  { name: "30+ days", value: 10, color: "#64748b" },
];

export function ChartsSection() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 font-sans text-lg font-semibold text-card-foreground">
          Weekly Delivery Rate
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={weeklyDeliveryData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
            <XAxis dataKey="day" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip
              contentStyle={{
                backgroundColor: BRAND_CHART.deepNavy,
                border: `1px solid ${BRAND_CHART.coolGray}`,
                borderRadius: 8,
                fontFamily: "DM Mono, monospace",
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="rate"
              stroke={BRAND_CHART.emerald}
              strokeWidth={2}
              dot={{ fill: BRAND_CHART.emerald, r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 font-sans text-lg font-semibold text-card-foreground">
          SLA Breaches by Agent/Region
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={slaBreachData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip
              contentStyle={{
                backgroundColor: BRAND_CHART.deepNavy,
                border: `1px solid ${BRAND_CHART.coolGray}`,
                borderRadius: 8,
                fontFamily: "DM Mono, monospace",
                fontSize: 12,
              }}
            />
            <Bar
              dataKey="breaches"
              fill={BRAND_CHART.coolGray}
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 font-sans text-lg font-semibold text-card-foreground">
          Inventory Low Stock Trend
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={inventoryTrendData}>
            <defs>
              <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={BRAND_CHART.emerald} stopOpacity={0.35} />
                <stop offset="95%" stopColor={BRAND_CHART.emerald} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} />
            <XAxis dataKey="week" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip
              contentStyle={{
                backgroundColor: BRAND_CHART.deepNavy,
                border: `1px solid ${BRAND_CHART.coolGray}`,
                borderRadius: 8,
                fontFamily: "DM Mono, monospace",
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="stock"
              stroke={BRAND_CHART.emerald}
              fillOpacity={1}
              fill="url(#stockGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 font-sans text-lg font-semibold text-card-foreground">
          Remittance Aging Breakdown
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={remittanceAgingData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={5}
              dataKey="value"
            >
              {remittanceAgingData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: BRAND_CHART.deepNavy,
                border: `1px solid ${BRAND_CHART.coolGray}`,
                borderRadius: 8,
                fontFamily: "DM Mono, monospace",
                fontSize: 12,
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
