import { useState, useEffect } from "react";
import {
  MapPin,
  Plus,
  X,
  Calendar,
  TrendingUp,
  Package,
} from "lucide-react";
import { fetchWaybillsByState, WaybillByState } from "../../services/dashboard";
import { useOrganization } from "../../contexts/OrganizationContext";
import { nigeriaStates } from "../../constants/nigeriaStates";
import { WaybillStatisticsTableHeader } from "./WaybillStatisticsTableHeader";
import { WaybillStatisticsTableRow } from "./WaybillStatisticsTableRow";
import "../deliveries/DeliveryTable.css";
import "./WaybillStatisticsTable.css";
import { TableLoadingCell } from "../ui/LoadingState";

export function WaybillStatisticsTable() {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<WaybillByState[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

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

  const handleFilterClick = (filterType: string) => {
    setActiveFilter(activeFilter === filterType ? null : filterType);
  };

  const handleFilterRemove = (filterType: string) => {
    if (filterType === "state") {
      setSelectedState("all");
    } else if (filterType === "startDate") {
      setStartDate("");
    } else if (filterType === "endDate") {
      setEndDate("");
    }
  };

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSelectedState("all");
    setActiveFilter(null);
  };

  // Calculate summary stats
  const totalQuantity = data.reduce((sum, item) => sum + item.totalQuantity, 0);
  const totalCost = data.reduce((sum, item) => sum + item.totalCost, 0);
  const totalWaybills = data.reduce((sum, item) => sum + item.waybillCount, 0);

  const hasActiveFilters = selectedState !== "all" || startDate || endDate;

  return (
    <div className="waybill-statistics-table-container">
      <div className="waybill-statistics-table-header">
        <div className="waybill-statistics-table-header-content">
          <div className="waybill-statistics-table-title-section">
            <div className="waybill-statistics-table-icon">
              <MapPin />
            </div>
            <div>
              <h2 className="waybill-statistics-table-title">
                Waybill Statistics by State
              </h2>
              <p className="waybill-statistics-table-subtitle">
                {data.length} state{data.length !== 1 ? "s" : ""} recorded
              </p>
            </div>
          </div>

          <div className="waybill-statistics-table-controls">
            {/* Filter Buttons */}
            <div className="waybill-statistics-table-filters">
              <button
                onClick={() => handleFilterClick("state")}
                className={`waybill-statistics-table-filter-button ${
                  selectedState !== "all" ? "active" : ""
                }`}
              >
                <Plus className="waybill-statistics-table-filter-icon" />
                State
                {selectedState !== "all" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilterRemove("state");
                    }}
                    className="waybill-statistics-table-filter-remove"
                  >
                    <X className="waybill-statistics-table-filter-remove-icon" />
                  </button>
                )}
              </button>
              <button
                onClick={() => handleFilterClick("startDate")}
                className={`waybill-statistics-table-filter-button ${
                  startDate ? "active" : ""
                }`}
              >
                <Plus className="waybill-statistics-table-filter-icon" />
                Start Date
                {startDate && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilterRemove("startDate");
                    }}
                    className="waybill-statistics-table-filter-remove"
                  >
                    <X className="waybill-statistics-table-filter-remove-icon" />
                  </button>
                )}
              </button>
              <button
                onClick={() => handleFilterClick("endDate")}
                className={`waybill-statistics-table-filter-button ${
                  endDate ? "active" : ""
                }`}
              >
                <Plus className="waybill-statistics-table-filter-icon" />
                End Date
                {endDate && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilterRemove("endDate");
                    }}
                    className="waybill-statistics-table-filter-remove"
                  >
                    <X className="waybill-statistics-table-filter-remove-icon" />
                  </button>
                )}
              </button>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="waybill-statistics-table-filter-button"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="waybill-statistics-summary-cards">
          <div className="waybill-statistics-summary-card blue">
            <div className="waybill-statistics-summary-card-label blue">
              <Package className="waybill-statistics-summary-card-icon" />
              <span>Total Quantity</span>
            </div>
            <div className="waybill-statistics-summary-card-value blue">
              {totalQuantity.toLocaleString()}
            </div>
          </div>
          <div className="waybill-statistics-summary-card green">
            <div className="waybill-statistics-summary-card-label green">
              <TrendingUp className="waybill-statistics-summary-card-icon" />
              <span>Total Waybills</span>
            </div>
            <div className="waybill-statistics-summary-card-value green">
              {totalWaybills.toLocaleString()}
            </div>
          </div>
          <div className="waybill-statistics-summary-card purple">
            <div className="waybill-statistics-summary-card-label purple">
              <Calendar className="waybill-statistics-summary-card-icon" />
              <span>Total Value</span>
            </div>
            <div className="waybill-statistics-summary-card-value purple">
              {formatCurrency(totalCost)}
            </div>
          </div>
        </div>

        {/* Filter Dropdowns */}
        {activeFilter && (
          <div className="waybill-statistics-table-filter-dropdowns">
            {activeFilter === "state" && (
              <div className="waybill-statistics-table-filter-dropdown">
                <label className="waybill-statistics-table-filter-label">
                  <MapPin className="waybill-statistics-table-filter-label-icon" />
                  Filter by State/Region
                </label>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="waybill-statistics-table-filter-select"
                >
                  <option value="all">All States</option>
                  {nigeriaStates
                    .filter((state) => state !== "Lagos")
                    .map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                </select>
              </div>
            )}
            {activeFilter === "startDate" && (
              <div className="waybill-statistics-table-filter-dropdown">
                <label className="waybill-statistics-table-filter-label">
                  <Calendar className="waybill-statistics-table-filter-label-icon" />
                  Filter by Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="waybill-statistics-table-filter-input"
                />
              </div>
            )}
            {activeFilter === "endDate" && (
              <div className="waybill-statistics-table-filter-dropdown">
                <label className="waybill-statistics-table-filter-label">
                  <Calendar className="waybill-statistics-table-filter-label-icon" />
                  Filter by End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="waybill-statistics-table-filter-input"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="waybill-statistics-table-wrapper delivery-table-wrapper">
        <table className="delivery-table">
          <WaybillStatisticsTableHeader />
          <tbody>
            {loading ? (
              <tr>
                <TableLoadingCell colSpan={7} message="Loading waybill statistics…" />
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={7} className="delivery-table-empty">
                  No waybill data found for the selected filters.
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <WaybillStatisticsTableRow
                  key={item.state}
                  item={item}
                  index={index}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

