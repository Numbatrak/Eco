"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../components/dashboard/AuthContext";
import { siteConfigApi } from "../../../lib/siteConfigApi";
import type {
  SiteConfig,
  TemplateId,
  SitePalette,
  SiteTypography,
  SiteSection,
} from "@platform/shared-types";
import { TEMPLATE_PRESETS, defaultSiteConfig } from "@platform/shared-types";
import { StorefrontPreview } from "../../../components/storefront/StorefrontPreview";

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

export default function BuilderPage(): React.ReactElement {
  const router = useRouter();
  const { activeOrganization } = useAuth();
  
  const [draft, setDraft] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [activeTab, setActiveTab] = useState<"design" | "content">("design");
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
        setDraft(cfg);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load config", err);
        // Fallback to default if load fails
        setDraft(defaultSiteConfig("market"));
        setLoading(false);
      });
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
    updateDraft({
      ...draft,
      theme: { ...draft.theme, palette },
    });
  };

  const setTypography = (typography: SiteTypography) => {
    if (!draft) return;
    updateDraft({
      ...draft,
      theme: { ...draft.theme, typography },
    });
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

  const updateSectionField = (index: number, field: string, value: string) => {
    if (!draft) return;
    const newSections = [...draft.sections];
    newSections[index] = { ...newSections[index], [field]: value } as SiteSection;
    updateDraft({ ...draft, sections: newSections });
  };

  const handlePublish = async () => {
    if (!draft) return;
    try {
      await siteConfigApi.save(draft);
      await siteConfigApi.publish();
      const domain = `${activeOrganization?.slug}.localhost:3000`;
      showToast(`Published to ${domain}`);
    } catch (err) {
      console.error("Failed to publish", err);
      showToast("Failed to publish");
    }
  };

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
          ←
        </button>
        <div className="flex flex-col leading-tight">
          <input
            className="w-full max-w-[220px] rounded bg-transparent px-1 py-0.5 text-[14.5px] font-semibold text-ink outline-none hover:bg-line-soft focus:bg-line-soft"
            value={activeOrganization?.name || "Your Shop"}
            readOnly
            title="Change in Site Settings"
          />
          <span className="px-1 text-[11.5px] tracking-wide text-muted">
            {activeOrganization?.slug}.localhost:3000
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
            ▭
          </button>
          <button
            className={`flex items-center px-2.5 py-1.5 ${
              device === "mobile" ? "bg-ink text-paper" : "bg-panel text-muted"
            }`}
            onClick={() => setDevice("mobile")}
            title="Mobile view"
          >
            ▯
          </button>
        </div>
        <button
          className="rounded-[9px] bg-accent px-4 py-2 text-[13.5px] font-semibold text-accent-ink transition-transform hover:-translate-y-px active:translate-y-0"
          onClick={() => void handlePublish()}
        >
          Publish
        </button>
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
            <span className="mb-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">
              Sections
            </span>
            <div className="flex flex-col gap-1">
              {draft.sections.map((sec, idx) => (
                <div
                  key={sec.id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-2 ${
                    selectedSectionId === sec.id ? "bg-line-soft" : ""
                  }`}
                >
                  <span className="text-xs tracking-[1px] text-muted">⠿⠿</span>
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
                    onClick={(e) => {
                      e.stopPropagation();
                      moveSection(idx, "up");
                    }}
                    title="Move up"
                  >
                    ▲
                  </button>
                  <button
                    className="flex h-[22px] w-[22px] items-center justify-center rounded-[5px] bg-transparent text-[11px] text-muted hover:bg-panel hover:text-ink"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveSection(idx, "down");
                    }}
                    title="Move down"
                  >
                    ▼
                  </button>
                  <button
                    className="flex h-[22px] w-[22px] items-center justify-center rounded-[5px] bg-transparent text-[11px] text-muted hover:bg-panel hover:text-ink"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSectionVis(idx);
                    }}
                    title="Toggle visibility"
                  >
                    👁
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
                {activeOrganization?.slug}.localhost:3000
              </div>
            </div>
            {/* The preview itself. We pass empty products list or sample ones to StorefrontPreview */}
            <StorefrontPreview 
              config={draft} 
              products={[]} 
              brandName={activeOrganization?.name || "Your Shop"} 
            />
          </div>
        </main>

        {/* Right Panel */}
        <aside className="w-[250px] shrink-0 overflow-y-auto border-l border-line bg-panel">
          <div className="flex gap-0.5 px-4 pt-3">
            <button
              className={`flex-1 border-b-2 bg-transparent py-2 text-[12.5px] font-semibold ${
                activeTab === "design"
                  ? "border-ink text-ink"
                  : "border-line text-muted hover:border-line-soft hover:text-ink"
              }`}
              onClick={() => setActiveTab("design")}
            >
              Design
            </button>
            <button
              className={`flex-1 border-b-2 bg-transparent py-2 text-[12.5px] font-semibold ${
                activeTab === "content"
                  ? "border-ink text-ink"
                  : "border-line text-muted hover:border-line-soft hover:text-ink"
              }`}
              onClick={() => setActiveTab("content")}
            >
              Content
            </button>
          </div>

          <div className="p-4" style={{ display: activeTab === "design" ? "block" : "none" }}>
            <div className="mb-4">
              <span className="mb-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                Palette
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
            <div className="mb-4">
              <span className="mb-3 block text-[11px] font-semibold uppercase tracking-wider text-muted">
                Typography
              </span>
              <div className="flex flex-col gap-2">
                {[
                  {
                    display: "bricolage",
                    body: "space-grotesk",
                    label: "Bricolage + Space Grotesk",
                  },
                  {
                    display: "fraunces",
                    body: "inter",
                    label: "Fraunces + Inter",
                  },
                ].map((pair, idx) => (
                  <button
                    key={idx}
                    className={`flex items-center justify-between rounded-[9px] border-[1.5px] px-3 py-2 text-left ${
                      draft.theme.typography.display === pair.display &&
                      draft.theme.typography.body === pair.body
                        ? "border-ink"
                        : "border-line"
                    }`}
                    onClick={() => setTypography(pair as SiteTypography)}
                  >
                    <div>
                      <div className="text-base" style={{ fontFamily: "var(--p-display)" }}>
                        Aa Coffee
                      </div>
                      <div className="mt-0.5 text-[10.5px] text-muted">{pair.label}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
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

          <div className="p-4" style={{ display: activeTab === "content" ? "block" : "none" }}>
            {selectedSection ? (
              <div className="flex flex-col gap-3">
                {selectedSection.kind === "hero" && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11.5px] text-muted">Headline</label>
                      <input
                        className="w-full rounded-[7px] border border-line bg-paper px-2 py-2 text-[13px] text-ink outline-none focus:border-ink"
                        value={selectedSection.headline}
                        onChange={(e) =>
                          updateSectionField(selectedSectionIndex, "headline", e.target.value)
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11.5px] text-muted">Subheading</label>
                      <textarea
                        className="w-full resize-y rounded-[7px] border border-line bg-paper px-2 py-2 text-[13px] text-ink outline-none focus:border-ink"
                        rows={3}
                        value={selectedSection.sub}
                        onChange={(e) =>
                          updateSectionField(selectedSectionIndex, "sub", e.target.value)
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11.5px] text-muted">Button label</label>
                      <input
                        className="w-full rounded-[7px] border border-line bg-paper px-2 py-2 text-[13px] text-ink outline-none focus:border-ink"
                        value={selectedSection.ctaLabel}
                        onChange={(e) =>
                          updateSectionField(selectedSectionIndex, "ctaLabel", e.target.value)
                        }
                      />
                    </div>
                  </>
                )}
                {selectedSection.kind === "products" && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11.5px] text-muted">Title</label>
                      <input
                        className="w-full rounded-[7px] border border-line bg-paper px-2 py-2 text-[13px] text-ink outline-none focus:border-ink"
                        value={selectedSection.title || ""}
                        onChange={(e) =>
                          updateSectionField(selectedSectionIndex, "title", e.target.value)
                        }
                      />
                    </div>
                  </>
                )}
                {selectedSection.kind === "visit" && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11.5px] text-muted">Title</label>
                      <input
                        className="w-full rounded-[7px] border border-line bg-paper px-2 py-2 text-[13px] text-ink outline-none focus:border-ink"
                        value={selectedSection.title || ""}
                        onChange={(e) =>
                          updateSectionField(selectedSectionIndex, "title", e.target.value)
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11.5px] text-muted">Address</label>
                      <textarea
                        className="w-full resize-y rounded-[7px] border border-line bg-paper px-2 py-2 text-[13px] text-ink outline-none focus:border-ink"
                        rows={2}
                        value={selectedSection.address || ""}
                        onChange={(e) =>
                          updateSectionField(selectedSectionIndex, "address", e.target.value)
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11.5px] text-muted">Hours</label>
                      <textarea
                        className="w-full resize-y rounded-[7px] border border-line bg-paper px-2 py-2 text-[13px] text-ink outline-none focus:border-ink"
                        rows={2}
                        value={selectedSection.hours || ""}
                        onChange={(e) =>
                          updateSectionField(selectedSectionIndex, "hours", e.target.value)
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11.5px] text-muted">Contact</label>
                      <textarea
                        className="w-full resize-y rounded-[7px] border border-line bg-paper px-2 py-2 text-[13px] text-ink outline-none focus:border-ink"
                        rows={2}
                        value={selectedSection.contact || ""}
                        onChange={(e) =>
                          updateSectionField(selectedSectionIndex, "contact", e.target.value)
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="py-2 text-[12.5px] leading-relaxed text-muted">
                Select a section from the left rail to edit its content.
              </div>
            )}
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
