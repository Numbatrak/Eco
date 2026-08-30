"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../components/dashboard/AuthContext";
import { siteConfigApi } from "../../../lib/siteConfigApi";
import { commerceApi } from "../../../lib/commerceApi";
import type {
  SiteConfig,
  TemplateId,
  SitePalette,
  SiteTypography,
  SiteSection,
  SiteSectionKind,
  SiteSocialLinks,
  SiteFooter,
  TrustBadgeItem,
} from "@platform/shared-types";
import { TEMPLATE_PRESETS, FONT_PAIRINGS, SECTION_CATALOG, defaultSiteConfig } from "@platform/shared-types";
import { StorefrontPreview } from "../../../components/storefront/StorefrontPreview";

// Client component - can't read the server-only BASE_DOMAIN that
// middleware.ts uses, so this mirrors it via the NEXT_PUBLIC_ variant
// (inlined at build time). Keep both in sync per environment.
const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "localhost:3000";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
): (...args: Parameters<T>) => void {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      const newTimeoutId = setTimeout(() => {
        callback(...args);
      }, delay);
      setTimeoutId(newTimeoutId);
    },
    [callback, delay, timeoutId],
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-8 cursor-pointer rounded border border-line bg-transparent p-0"
        style={{ appearance: "none", WebkitAppearance: "none" }}
      />
      <div className="flex flex-col">
        <span className="text-[10.5px] text-muted">{label}</span>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);
          }}
          className="w-[72px] rounded bg-transparent px-1 py-0.5 text-[11.5px] font-mono text-ink outline-none hover:bg-line-soft focus:bg-line-soft"
        />
      </div>
    </div>
  );
}

function newSection(kind: SiteSectionKind): SiteSection {
  const id = `${kind}-${Date.now()}`;
  switch (kind) {
    case "announcement":
      return { id, kind, visible: true, messages: ["Free shipping on all orders!"] };
    case "hero":
      return { id, kind, visible: true, eyebrow: "", headline: "Your headline here", sub: "A short description", ctaLabel: "Shop now" };
    case "featured-collections":
      return { id, kind, visible: true, eyebrow: "", title: "Collections", maxItems: 3 };
    case "products":
      return { id, kind, visible: true, title: "Featured products" };
    case "brand-story":
      return { id, kind, visible: true, eyebrow: "", headline: "Our story", body: "Tell your brand story here.", ctaLabel: "" };
    case "trust-badges":
      return { id, kind, visible: true, items: [
        { title: "Fast delivery", body: "Ships within 24 hours." },
        { title: "Secure payment", body: "Encrypted transactions." },
      ] };
    case "visit":
      return { id, kind, visible: true, title: "Visit & hours", address: "", hours: "", contact: "" };
  }
}

export default function BuilderPage(): React.ReactElement {
  const router = useRouter();
  const { activeOrganization } = useAuth();

  const [draft, setDraft] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [activeTab, setActiveTab] = useState<"design" | "content" | "social">("design");
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);

  const saveConfig = useCallback(
    async (configToSave: SiteConfig) => {
      setSaving(true);
      try {
        await siteConfigApi.save(configToSave);
      } catch (err) {
        console.error("Failed to save draft", err);
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const debouncedSave = useDebounce(saveConfig, 600);

  useEffect(() => {
    siteConfigApi
      .get()
      .then((cfg) => {
        if (!cfg.social) cfg.social = {};
        if (!cfg.footer) cfg.footer = { tagline: "", showSocial: true };
        setDraft(cfg);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load config", err);
        setDraft(defaultSiteConfig("market"));
        setLoading(false);
      });
    commerceApi
      .getTenantSettings()
      .then((s) => setIsPublished(s.published))
      .catch(() => {});
  }, []);

  const updateDraft = (newDraft: SiteConfig) => {
    setDraft(newDraft);
    debouncedSave(newDraft);
  };

  const setTemplate = (templateId: TemplateId) => {
    if (!draft) return;
    const preset = TEMPLATE_PRESETS[templateId];
    updateDraft({
      ...draft,
      theme: {
        ...draft.theme,
        templateId,
        palette: preset.palette,
        typography: preset.typography,
      },
    });
  };

  const setPalette = (palette: SitePalette) => {
    if (!draft) return;
    updateDraft({ ...draft, theme: { ...draft.theme, palette } });
  };

  const updatePaletteField = (field: keyof SitePalette, value: string) => {
    if (!draft) return;
    setPalette({ ...draft.theme.palette, [field]: value });
  };

  const setTypography = (typography: SiteTypography) => {
    if (!draft) return;
    updateDraft({ ...draft, theme: { ...draft.theme, typography } });
  };

  const moveSection = (index: number, direction: "up" | "down") => {
    if (!draft) return;
    const newSections = [...draft.sections];
    if (direction === "up" && index > 0) {
      const temp = newSections[index - 1];
      if (temp !== undefined) {
        newSections[index - 1] = newSections[index] as SiteSection;
        newSections[index] = temp;
      }
    } else if (direction === "down" && index < newSections.length - 1) {
      const temp = newSections[index + 1];
      if (temp !== undefined) {
        newSections[index + 1] = newSections[index] as SiteSection;
        newSections[index] = temp;
      }
    }
    updateDraft({ ...draft, sections: newSections });
  };

  const toggleSectionVis = (index: number) => {
    if (!draft) return;
    const newSections = [...draft.sections];
    const section = newSections[index];
    if (section !== undefined) {
      newSections[index] = { ...section, visible: !section.visible } as SiteSection;
    }
    updateDraft({ ...draft, sections: newSections });
  };

  const deleteSection = (index: number) => {
    if (!draft) return;
    const newSections = draft.sections.filter((_, i) => i !== index);
    if (selectedSectionId === draft.sections[index]?.id) {
      setSelectedSectionId(null);
    }
    updateDraft({ ...draft, sections: newSections });
  };

  const addSection = (kind: SiteSectionKind) => {
    if (!draft) return;
    const sec = newSection(kind);
    updateDraft({ ...draft, sections: [...draft.sections, sec] });
    setSelectedSectionId(sec.id);
    setActiveTab("content");
    setShowAddSection(false);
  };

  const updateSectionField = (index: number, field: string, value: unknown) => {
    if (!draft) return;
    const newSections = [...draft.sections];
    newSections[index] = { ...newSections[index], [field]: value } as SiteSection;
    updateDraft({ ...draft, sections: newSections });
  };

  const updateSocial = (field: keyof SiteSocialLinks, value: string) => {
    if (!draft) return;
    updateDraft({ ...draft, social: { ...draft.social, [field]: value || undefined } });
  };

  const updateFooter = (field: keyof SiteFooter, value: unknown) => {
    if (!draft) return;
    updateDraft({ ...draft, footer: { ...draft.footer, [field]: value } });
  };

  const handlePublish = async () => {
    if (!draft) return;
    try {
      await siteConfigApi.save(draft);
      await siteConfigApi.publish();
      setIsPublished(true);
      showToast(`Published to ${tenantDomain}`);
    } catch (err) {
      console.error("Failed to publish", err);
      showToast("Failed to publish");
    }
  };

  const tenantDomain = `${activeOrganization?.slug}.${BASE_DOMAIN}`;
  const siteUrl = `${BASE_DOMAIN.startsWith("localhost") ? "http" : "https"}://${tenantDomain}`;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  if (loading || !draft) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  const selectedSectionIndex = selectedSectionId
    ? draft.sections.findIndex((s) => s.id === selectedSectionId)
    : -1;
  const selectedSection = selectedSectionIndex >= 0 ? draft.sections[selectedSectionIndex] : null;

  return (
    <div className="flex h-screen flex-col bg-paper font-sans text-ink">
      {/* Topbar */}
      <div className="flex shrink-0 items-center gap-4 border-b border-line bg-panel px-4 py-3 z-20">
        <button
          className="flex h-8 w-8 items-center justify-center rounded border border-transparent hover:bg-line-soft"
          title="Back to Dashboard"
          onClick={() => router.push("/dashboard")}
        >
          &larr;
        </button>
        <div className="flex flex-col leading-tight">
          <input
            className="w-full max-w-[220px] rounded bg-transparent px-1 py-0.5 text-[14.5px] font-semibold text-ink outline-none hover:bg-line-soft focus:bg-line-soft"
            value={activeOrganization?.name || "Your Shop"}
            readOnly
            title="Change in Site Settings"
          />
          <span className="px-1 text-[11.5px] tracking-wide text-muted">
            {tenantDomain}
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 whitespace-nowrap text-xs text-muted">
          <span
            className={`h-1.5 w-1.5 rounded-full ${saving ? "bg-accent" : "bg-[#3E8E6B]"}`}
          />
          {saving ? "Saving..." : "Saved"}
        </div>
        <div className="flex overflow-hidden rounded-[9px] border border-line">
          <button
            className={`flex items-center px-2.5 py-1.5 ${
              device === "desktop" ? "bg-ink text-paper" : "bg-panel text-muted"
            }`}
            onClick={() => setDevice("desktop")}
            title="Desktop view"
          >
            &#x25AD;
          </button>
          <button
            className={`flex items-center px-2.5 py-1.5 ${
              device === "mobile" ? "bg-ink text-paper" : "bg-panel text-muted"
            }`}
            onClick={() => setDevice("mobile")}
            title="Mobile view"
          >
            &#x25AF;
          </button>
        </div>
        <button
          className="rounded-[9px] bg-accent px-4 py-2 text-[13.5px] font-semibold text-accent-ink transition-transform hover:-translate-y-px active:translate-y-0"
          onClick={() => void handlePublish()}
        >
          Publish
        </button>
        {isPublished && (
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[9px] border border-line px-4 py-2 text-[13.5px] font-semibold text-ink transition-transform hover:-translate-y-px hover:bg-line-soft active:translate-y-0"
          >
            Visit Site &nearr;
          </a>
        )}
      </div>

      {/* Workspace */}
      <div className="relative flex flex-1 min-h-0">
        {/* Left Rail */}
        <aside className="w-[250px] shrink-0 overflow-y-auto border-r border-line bg-panel">
          <div className="border-b border-line-soft p-4">
            <span className="mb-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">
              Template
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(["market", "studio", "corner"] as TemplateId[]).map((tId) => (
                <button
                  key={tId}
                  className={`flex flex-col items-center gap-1.5 rounded-[9px] border-[1.5px] p-1.5 pb-2 ${
                    draft.theme.templateId === tId
                      ? "border-ink shadow-[0_0_0_1px_var(--ink)]"
                      : "border-line bg-paper"
                  }`}
                  onClick={() => setTemplate(tId)}
                >
                  <span className="relative h-11 w-full overflow-hidden rounded-[5px] bg-line-soft">
                    <span className="absolute inset-x-1.5 top-1.5 h-1.5 rounded-[3px] bg-muted opacity-50" />
                    <span className="absolute bottom-2 left-1.5 h-3 w-1/3 rounded-[3px] bg-accent" />
                  </span>
                  <span className="text-[11.5px] font-medium capitalize">{tId}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Sections
              </span>
              <button
                className="rounded-md bg-ink px-2 py-0.5 text-[10.5px] font-semibold text-paper hover:opacity-80"
                onClick={() => setShowAddSection(!showAddSection)}
              >
                + Add
              </button>
            </div>

            {showAddSection && (
              <div className="mb-3 rounded-lg border border-line bg-paper p-2">
                {SECTION_CATALOG.map((cat) => (
                  <button
                    key={cat.kind}
                    className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-line-soft"
                    onClick={() => addSection(cat.kind)}
                  >
                    <span className="text-[12.5px] font-medium">{cat.label}</span>
                    <span className="text-[10.5px] text-muted">{cat.description}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-1">
              {draft.sections.map((sec, idx) => (
                <div
                  key={sec.id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-2 ${
                    selectedSectionId === sec.id ? "bg-line-soft" : ""
                  }`}
                >
                  <span className="text-xs tracking-[1px] text-muted">&#x2807;&#x2807;</span>
                  <button
                    className={`flex-1 bg-transparent p-0 text-left text-[13px] font-medium ${
                      sec.visible ? "text-ink" : "text-muted line-through"
                    }`}
                    onClick={() => {
                      setSelectedSectionId(sec.id);
                      setActiveTab("content");
                    }}
                  >
                    {sec.kind}
                  </button>
                  <button
                    className="flex h-[22px] w-[22px] items-center justify-center rounded-[5px] bg-transparent text-[11px] text-muted hover:bg-panel hover:text-ink"
                    onClick={(e) => { e.stopPropagation(); moveSection(idx, "up"); }}
                    title="Move up"
                  >
                    &#x25B2;
                  </button>
                  <button
                    className="flex h-[22px] w-[22px] items-center justify-center rounded-[5px] bg-transparent text-[11px] text-muted hover:bg-panel hover:text-ink"
                    onClick={(e) => { e.stopPropagation(); moveSection(idx, "down"); }}
                    title="Move down"
                  >
                    &#x25BC;
                  </button>
                  <button
                    className="flex h-[22px] w-[22px] items-center justify-center rounded-[5px] bg-transparent text-[11px] text-muted hover:bg-panel hover:text-ink"
                    onClick={(e) => { e.stopPropagation(); toggleSectionVis(idx); }}
                    title="Toggle visibility"
                  >
                    {sec.visible ? "◉" : "○"}
                  </button>
                  <button
                    className="flex h-[22px] w-[22px] items-center justify-center rounded-[5px] bg-transparent text-[11px] text-red-500 hover:bg-red-50 hover:text-red-700"
                    onClick={(e) => { e.stopPropagation(); deleteSection(idx); }}
                    title="Remove section"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Stage */}
        <main className="flex flex-1 items-start justify-center overflow-auto bg-[#EFEAE0] p-6 pb-16">
          <div
            className={`w-full overflow-hidden rounded-[14px] bg-panel shadow-[0_1px_2px_rgba(20,16,8,0.06),_0_18px_40px_-18px_rgba(20,16,8,0.28)] transition-all duration-250 ease-out ${
              device === "mobile" ? "max-w-[390px]" : "max-w-[900px]"
            }`}
          >
            <div className="flex items-center gap-2.5 border-b border-line-soft bg-panel px-3.5 py-2">
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-line" />
                <span className="h-2 w-2 rounded-full bg-line" />
                <span className="h-2 w-2 rounded-full bg-line" />
              </div>
              <div className="flex-1 rounded-[7px] bg-paper px-2.5 py-1 text-center font-sans text-[11.5px] text-muted">
                {tenantDomain}
              </div>
            </div>
            <StorefrontPreview
              config={draft}
              products={[]}
              collections={[]}
              brandName={activeOrganization?.name || "Your Shop"}
            />
          </div>
        </main>

        {/* Right Panel */}
        <aside className="w-[280px] shrink-0 overflow-y-auto border-l border-line bg-panel">
          <div className="flex gap-0.5 px-4 pt-3">
            {(["design", "content", "social"] as const).map((tab) => (
              <button
                key={tab}
                className={`flex-1 border-b-2 bg-transparent py-2 text-[12.5px] font-semibold capitalize ${
                  activeTab === tab
                    ? "border-ink text-ink"
                    : "border-line text-muted hover:border-line-soft hover:text-ink"
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* ─── Design Tab ─── */}
          <div className="p-4" style={{ display: activeTab === "design" ? "block" : "none" }}>
            {/* Preset swatches */}
            <div className="mb-4">
              <span className="mb-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                Palette presets
              </span>
              <div className="flex flex-wrap gap-2.5">
                {Object.values(TEMPLATE_PRESETS).map((preset, idx) => (
                  <button
                    key={idx}
                    className={`relative h-11 w-11 shrink-0 rounded-[10px] border-2 ${
                      draft.theme.palette.bg === preset.palette.bg &&
                      draft.theme.palette.accent === preset.palette.accent
                        ? "border-ink"
                        : "border-transparent"
                    }`}
                    style={{ background: preset.palette.bg }}
                    onClick={() => setPalette(preset.palette)}
                  >
                    <span
                      className="absolute inset-[3px] rounded-[7px]"
                      style={{ background: preset.palette.accent }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Custom colors */}
            <div className="mb-4">
              <span className="mb-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                Custom colors
              </span>
              <div className="flex flex-col gap-2.5">
                <ColorInput label="Background" value={draft.theme.palette.bg} onChange={(v) => updatePaletteField("bg", v)} />
                <ColorInput label="Text" value={draft.theme.palette.ink} onChange={(v) => updatePaletteField("ink", v)} />
                <ColorInput label="Accent" value={draft.theme.palette.accent} onChange={(v) => updatePaletteField("accent", v)} />
              </div>
            </div>

            {/* Typography */}
            <div className="mb-4">
              <span className="mb-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                Typography
              </span>
              <div className="flex flex-col gap-2">
                {FONT_PAIRINGS.map((pair, idx) => (
                  <button
                    key={idx}
                    className={`flex items-center justify-between rounded-[9px] border-[1.5px] px-3 py-2 text-left ${
                      draft.theme.typography.display === pair.display &&
                      draft.theme.typography.body === pair.body
                        ? "border-ink"
                        : "border-line"
                    }`}
                    onClick={() => setTypography({ display: pair.display, body: pair.body })}
                  >
                    <div>
                      <div className="text-[13px] font-semibold">{pair.label}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Logo */}
            <div>
              <span className="mb-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                Logo
              </span>
              <div className="rounded-[9px] border-[1.5px] border-dashed border-line p-2.5 text-center text-xs text-muted">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/svg+xml"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        updateDraft({
                          ...draft,
                          theme: { ...draft.theme, logoUrl: ev.target?.result as string },
                        });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="mb-2 block w-full text-xs"
                />
                Drop an image, or click to upload
                <br />
                PNG or SVG, up to 2MB
              </div>
            </div>
          </div>

          {/* ─── Content Tab ─── */}
          <div className="p-4" style={{ display: activeTab === "content" ? "block" : "none" }}>
            {selectedSection ? (
              <div className="flex flex-col gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {selectedSection.kind}
                </span>

                {/* ── Announcement ── */}
                {selectedSection.kind === "announcement" && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11.5px] text-muted">Messages (one per line)</label>
                      <textarea
                        className="w-full resize-y rounded-[7px] border border-line bg-paper px-2 py-2 text-[13px] text-ink outline-none focus:border-ink"
                        rows={4}
                        value={selectedSection.messages.join("\n")}
                        onChange={(e) =>
                          updateSectionField(
                            selectedSectionIndex,
                            "messages",
                            e.target.value.split("\n").filter(Boolean),
                          )
                        }
                      />
                    </div>
                  </>
                )}

                {/* ── Hero ── */}
                {selectedSection.kind === "hero" && (
                  <>
                    <FieldInput label="Eyebrow" value={selectedSection.eyebrow || ""} onChange={(v) => updateSectionField(selectedSectionIndex, "eyebrow", v)} />
                    <FieldInput label="Headline" value={selectedSection.headline} onChange={(v) => updateSectionField(selectedSectionIndex, "headline", v)} />
                    <FieldTextarea label="Subheading" value={selectedSection.sub} onChange={(v) => updateSectionField(selectedSectionIndex, "sub", v)} />
                    <FieldInput label="Button label" value={selectedSection.ctaLabel} onChange={(v) => updateSectionField(selectedSectionIndex, "ctaLabel", v)} />
                    <FieldInput label="Button URL" value={selectedSection.ctaUrl || ""} onChange={(v) => updateSectionField(selectedSectionIndex, "ctaUrl", v)} />
                    <div className="flex flex-col gap-1">
                      <label className="text-[11.5px] text-muted">Hero image</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              updateSectionField(selectedSectionIndex, "imageUrl", ev.target?.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="text-xs"
                      />
                      {selectedSection.imageUrl && (
                        <button
                          className="mt-1 text-left text-[11px] text-red-500 hover:underline"
                          onClick={() => updateSectionField(selectedSectionIndex, "imageUrl", undefined)}
                        >
                          Remove image
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* ── Products ── */}
                {selectedSection.kind === "products" && (
                  <FieldInput label="Title" value={selectedSection.title || ""} onChange={(v) => updateSectionField(selectedSectionIndex, "title", v)} />
                )}

                {/* ── Featured Collections ── */}
                {selectedSection.kind === "featured-collections" && (
                  <>
                    <FieldInput label="Eyebrow" value={selectedSection.eyebrow || ""} onChange={(v) => updateSectionField(selectedSectionIndex, "eyebrow", v)} />
                    <FieldInput label="Title" value={selectedSection.title || ""} onChange={(v) => updateSectionField(selectedSectionIndex, "title", v)} />
                    <div className="flex flex-col gap-1">
                      <label className="text-[11.5px] text-muted">Max items</label>
                      <input
                        type="number"
                        min={1}
                        max={6}
                        value={selectedSection.maxItems ?? 3}
                        onChange={(e) => updateSectionField(selectedSectionIndex, "maxItems", parseInt(e.target.value) || 3)}
                        className="w-16 rounded-[7px] border border-line bg-paper px-2 py-2 text-[13px] text-ink outline-none focus:border-ink"
                      />
                    </div>
                  </>
                )}

                {/* ── Brand Story ── */}
                {selectedSection.kind === "brand-story" && (
                  <>
                    <FieldInput label="Eyebrow" value={selectedSection.eyebrow || ""} onChange={(v) => updateSectionField(selectedSectionIndex, "eyebrow", v)} />
                    <FieldInput label="Headline" value={selectedSection.headline} onChange={(v) => updateSectionField(selectedSectionIndex, "headline", v)} />
                    <FieldTextarea label="Body" value={selectedSection.body} rows={5} onChange={(v) => updateSectionField(selectedSectionIndex, "body", v)} />
                    <FieldInput label="Link text" value={selectedSection.ctaLabel || ""} onChange={(v) => updateSectionField(selectedSectionIndex, "ctaLabel", v)} />
                    <FieldInput label="Link URL" value={selectedSection.ctaUrl || ""} onChange={(v) => updateSectionField(selectedSectionIndex, "ctaUrl", v)} />
                  </>
                )}

                {/* ── Trust Badges ── */}
                {selectedSection.kind === "trust-badges" && (
                  <>
                    {selectedSection.items.map((item: TrustBadgeItem, i: number) => (
                      <div key={i} className="rounded-lg border border-line p-2">
                        <FieldInput
                          label={`Badge ${i + 1} title`}
                          value={item.title}
                          onChange={(v) => {
                            const newItems = [...selectedSection.items];
                            newItems[i] = { title: v, body: newItems[i]!.body };
                            updateSectionField(selectedSectionIndex, "items", newItems);
                          }}
                        />
                        <FieldInput
                          label="Description"
                          value={item.body}
                          onChange={(v) => {
                            const newItems = [...selectedSection.items];
                            newItems[i] = { title: newItems[i]!.title, body: v };
                            updateSectionField(selectedSectionIndex, "items", newItems);
                          }}
                        />
                        {selectedSection.items.length > 1 && (
                          <button
                            className="mt-1 text-[10.5px] text-red-500 hover:underline"
                            onClick={() => {
                              const newItems = selectedSection.items.filter((_: TrustBadgeItem, j: number) => j !== i);
                              updateSectionField(selectedSectionIndex, "items", newItems);
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    {selectedSection.items.length < 6 && (
                      <button
                        className="rounded-md border border-dashed border-line px-3 py-1.5 text-[12px] text-muted hover:bg-line-soft"
                        onClick={() => {
                          const newItems = [...selectedSection.items, { title: "New badge", body: "Description" }];
                          updateSectionField(selectedSectionIndex, "items", newItems);
                        }}
                      >
                        + Add badge
                      </button>
                    )}
                  </>
                )}

                {/* ── Visit ── */}
                {selectedSection.kind === "visit" && (
                  <>
                    <FieldInput label="Title" value={selectedSection.title || ""} onChange={(v) => updateSectionField(selectedSectionIndex, "title", v)} />
                    <FieldTextarea label="Address" value={selectedSection.address || ""} onChange={(v) => updateSectionField(selectedSectionIndex, "address", v)} />
                    <FieldTextarea label="Hours" value={selectedSection.hours || ""} onChange={(v) => updateSectionField(selectedSectionIndex, "hours", v)} />
                    <FieldTextarea label="Contact" value={selectedSection.contact || ""} onChange={(v) => updateSectionField(selectedSectionIndex, "contact", v)} />
                  </>
                )}
              </div>
            ) : (
              <div className="py-2 text-[12.5px] leading-relaxed text-muted">
                Select a section from the left rail to edit its content.
              </div>
            )}
          </div>

          {/* ─── Social Tab ─── */}
          <div className="p-4" style={{ display: activeTab === "social" ? "block" : "none" }}>
            <span className="mb-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">
              Social links
            </span>
            <div className="flex flex-col gap-2.5 mb-5">
              <FieldInput label="Instagram URL" value={draft.social?.instagram || ""} onChange={(v) => updateSocial("instagram", v)} />
              <FieldInput label="TikTok URL" value={draft.social?.tiktok || ""} onChange={(v) => updateSocial("tiktok", v)} />
              <FieldInput label="Twitter / X URL" value={draft.social?.twitter || ""} onChange={(v) => updateSocial("twitter", v)} />
              <FieldInput label="Facebook URL" value={draft.social?.facebook || ""} onChange={(v) => updateSocial("facebook", v)} />
              <FieldInput label="WhatsApp number" value={draft.social?.whatsapp || ""} onChange={(v) => updateSocial("whatsapp", v)} />
            </div>

            <span className="mb-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">
              Footer
            </span>
            <div className="flex flex-col gap-2.5">
              <FieldInput label="Tagline" value={draft.footer?.tagline || ""} onChange={(v) => updateFooter("tagline", v)} />
              <label className="flex items-center gap-2 text-[12.5px]">
                <input
                  type="checkbox"
                  checked={draft.footer?.showSocial !== false}
                  onChange={(e) => updateFooter("showSocial", e.target.checked)}
                />
                Show social links in footer
              </label>
            </div>
          </div>
        </aside>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-[9px] bg-ink px-4 py-2.5 text-[13px] text-paper shadow-lg">
          <span className="h-1.5 w-1.5 rounded-full bg-[#5FBF8F]" />
          {toastMessage}
        </div>
      )}
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11.5px] text-muted">{label}</label>
      <input
        className="w-full rounded-[7px] border border-line bg-paper px-2 py-2 text-[13px] text-ink outline-none focus:border-ink"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function FieldTextarea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11.5px] text-muted">{label}</label>
      <textarea
        className="w-full resize-y rounded-[7px] border border-line bg-paper px-2 py-2 text-[13px] text-ink outline-none focus:border-ink"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
