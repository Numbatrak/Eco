import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  addReservedSubdomainRequestSchema,
  type AddReservedSubdomainRequest,
  type FeatureFlag,
  type PlatformSetting,
  type ReservedSubdomain,
} from "@platform/shared-types";
import { TextField } from "../../components/TextField";
import { platformAdminApi } from "../lib/platformAdminApi";
import { formatDateTime } from "../lib/format";
import { ApiError } from "../../lib/apiClient";

type Tab = "reserved-subdomains" | "feature-flags" | "settings";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "reserved-subdomains", label: "Reserved subdomains" },
  { id: "feature-flags", label: "Feature flags" },
  { id: "settings", label: "Settings" },
];

function ReservedSubdomainsTab(): React.ReactElement {
  const [words, setWords] = useState<ReservedSubdomain[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load(): void {
    platformAdminApi
      .listReservedSubdomains()
      .then((res) => setWords(res.reservedSubdomains))
      .catch(() => setError("Could not load reserved subdomains."));
  }

  useEffect(load, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddReservedSubdomainRequest>({
    resolver: zodResolver(addReservedSubdomainRequestSchema),
    defaultValues: { word: "" },
  });

  async function onSubmit(values: AddReservedSubdomainRequest): Promise<void> {
    setError(null);
    try {
      await platformAdminApi.addReservedSubdomain(values);
      reset({ word: "" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  async function handleRemove(word: string): Promise<void> {
    setError(null);
    try {
      await platformAdminApi.removeReservedSubdomain(word);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <div>
      {error ? (
        <div className="banner banner-danger" role="alert">
          {error}
        </div>
      ) : null}
      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{ display: "flex", gap: 8, alignItems: "flex-start", maxWidth: 360 }}
      >
        <div style={{ flex: 1 }}>
          <TextField label="Add word" error={errors.word?.message} {...register("word")} />
        </div>
        <button type="submit" className="btn btn-secondary" disabled={isSubmitting}>
          Add
        </button>
      </form>
      <table className="pa-table" style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>Word</th>
            <th>Added</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {words.map((word) => (
            <tr key={word.word}>
              <td>{word.word}</td>
              <td>{formatDateTime(word.createdAt)}</td>
              <td>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => void handleRemove(word.word)}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeatureFlagsTab(): React.ReactElement {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load(): void {
    platformAdminApi
      .listFeatureFlags()
      .then((res) => setFlags(res.featureFlags))
      .catch(() => setError("Could not load feature flags."));
  }

  useEffect(load, []);

  async function handleToggle(flag: FeatureFlag): Promise<void> {
    setError(null);
    try {
      await platformAdminApi.updateFeatureFlag(flag.key, {
        enabled: !flag.enabled,
        description: flag.description ?? undefined,
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <div>
      {error ? (
        <div className="banner banner-danger" role="alert">
          {error}
        </div>
      ) : null}
      <table className="pa-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Description</th>
            <th>Enabled</th>
          </tr>
        </thead>
        <tbody>
          {flags.map((flag) => (
            <tr key={flag.key}>
              <td>{flag.key}</td>
              <td>{flag.description ?? "—"}</td>
              <td>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={flag.enabled}
                    onChange={() => void handleToggle(flag)}
                    aria-label={`Toggle ${flag.key}`}
                  />
                </label>
              </td>
            </tr>
          ))}
          {flags.length === 0 ? (
            <tr>
              <td colSpan={3} className="field-hint">
                No feature flags yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function SettingsTab(): React.ReactElement {
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function load(): void {
    platformAdminApi
      .listSettings()
      .then((res) => {
        setSettings(res.settings);
        setDrafts(Object.fromEntries(res.settings.map((s) => [s.key, s.value ?? ""])));
      })
      .catch(() => setError("Could not load settings."));
  }

  useEffect(load, []);

  async function handleSave(key: string): Promise<void> {
    setError(null);
    try {
      await platformAdminApi.updateSetting(key, { value: drafts[key] ?? "" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <div>
      {error ? (
        <div className="banner banner-danger" role="alert">
          {error}
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}>
        {settings.map((setting) => (
          <div key={setting.key} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <TextField
                label={setting.key}
                value={drafts[setting.key] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [setting.key]: e.target.value }))}
              />
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => void handleSave(setting.key)}>
              Save
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ConfigPage(): React.ReactElement {
  const [tab, setTab] = useState<Tab>("reserved-subdomains");

  return (
    <div>
      <h1>Platform config</h1>
      <div className="pa-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`pa-tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "reserved-subdomains" ? <ReservedSubdomainsTab /> : null}
      {tab === "feature-flags" ? <FeatureFlagsTab /> : null}
      {tab === "settings" ? <SettingsTab /> : null}
    </div>
  );
}
