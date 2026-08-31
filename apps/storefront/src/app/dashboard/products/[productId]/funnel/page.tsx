"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { commerceApi } from "../../../../../lib/commerceApi";
import { useAuth } from "../../../../../components/dashboard/AuthContext";
import type { FunnelSection, FunnelSectionKind } from "@platform/shared-types";
import { FUNNEL_SECTION_CATALOG, defaultFunnelSections } from "@platform/shared-types";

// Client component - mirrors dashboard/builder/page.tsx's exact pattern for
// reading the storefront's own domain.
const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "localhost:3000";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
): (...args: Parameters<T>) => void {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutId) clearTimeout(timeoutId);
      setTimeoutId(setTimeout(() => callback(...args), delay));
    },
    [callback, delay, timeoutId],
  );
}

function newFunnelSection(kind: FunnelSectionKind): FunnelSection {
  const id = `${kind}-${Date.now()}`;
  switch (kind) {
    case "funnel-hero":
      return { id, kind, visible: true, eyebrow: "", headline: "Your headline here", sub: "A short line about the problem this solves." };
    case "funnel-story":
      return { id, kind, visible: true, title: "Our story", body: "Tell buyers why this product exists." };
    case "funnel-solution":
      return { id, kind, visible: true, title: "The solution", body: "Explain how this product solves the problem." };
    case "funnel-how-it-works":
      return { id, kind, visible: true, title: "How it works", steps: [{ title: "Step 1", body: "Describe the step." }] };
    case "funnel-who-its-for":
      return { id, kind, visible: true, title: "Who it's for", items: ["Anyone who wants a better result."] };
    case "funnel-testimonials":
      return { id, kind, visible: true, title: "What customers say", items: [{ quote: "This changed everything for me.", author: "A happy customer" }] };
    case "funnel-packages":
      return { id, kind, visible: true, title: "Choose your package", options: [{ id: `pkg-${Date.now()}`, label: "1 unit", quantity: 1, priceCents: 0 }] };
    case "funnel-guarantee":
      return { id, kind, visible: true, title: "Our guarantee", body: "Describe your guarantee or return policy." };
    case "funnel-faq":
      return { id, kind, visible: true, title: "Frequently asked questions", items: [{ question: "How long does delivery take?", answer: "Describe your delivery timeline." }] };
    case "funnel-order":
      return { id, kind, visible: true, title: "Order now", ctaLabel: "Place order" };
  }
}

export default function ProductFunnelPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}): React.ReactElement {
  const { productId } = use(params);
  const router = useRouter();
  const { activeOrganization } = useAuth();

  const [sections, setSections] = useState<FunnelSection[] | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const saveSections = useCallback(async (toSave: FunnelSection[]) => {
    setSaving(true);
    try {
      await commerceApi.saveFunnelConfig(productId, { sections: toSave });
    } catch (err) {
      console.error("Failed to save funnel draft", err);
    } finally {
      setSaving(false);
    }
  }, [productId]);

  const debouncedSave = useDebounce(saveSections, 600);

  useEffect(() => {
    commerceApi
      .getFunnelConfig(productId)
      .then((cfg) => {
        setSections(cfg.sections);
        setIsPublished(cfg.isPublished);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load funnel config", err);
        setSections(defaultFunnelSections());
        setLoading(false);
      });
  }, [productId]);

  const updateSections = (next: FunnelSection[]) => {
    setSections(next);
    debouncedSave(next);
  };

  const moveSection = (index: number, direction: "up" | "down") => {
    if (!sections) return;
    const next = [...sections];
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= next.length) return;
    const temp = next[swapWith];
    next[swapWith] = next[index] as FunnelSection;
    next[index] = temp as FunnelSection;
    updateSections(next);
  };

  const toggleSectionVis = (index: number) => {
    if (!sections) return;
    const next = [...sections];
    const section = next[index];
    if (section) next[index] = { ...section, visible: !section.visible } as FunnelSection;
    updateSections(next);
  };

  const deleteSection = (index: number) => {
    if (!sections) return;
    if (selectedSectionId === sections[index]?.id) setSelectedSectionId(null);
    updateSections(sections.filter((_, i) => i !== index));
  };

  const addSection = (kind: FunnelSectionKind) => {
    if (!sections) return;
    const section = newFunnelSection(kind);
    updateSections([...sections, section]);
    setSelectedSectionId(section.id);
    setShowAddSection(false);
  };

  const updateSectionField = (index: number, field: string, value: unknown) => {
    if (!sections) return;
    const next = [...sections];
    next[index] = { ...next[index], [field]: value } as FunnelSection;
    updateSections(next);
  };

  const handlePublishToggle = async () => {
    try {
      if (isPublished) {
        await commerceApi.unpublishFunnel(productId);
        setIsPublished(false);
        showToast("Funnel turned off");
      } else {
        if (sections) await saveSections(sections);
        await commerceApi.publishFunnel(productId);
        setIsPublished(true);
        showToast("Funnel published");
      }
    } catch (err) {
      console.error("Failed to update funnel publish state", err);
      showToast("Failed to update funnel");
    }
  };

  const funnelUrl = `${BASE_DOMAIN.startsWith("localhost") ? "http" : "https"}://${activeOrganization?.slug}.${BASE_DOMAIN}/funnel/${productId}`;

  const copyFunnelLink = async () => {
    const url = funnelUrl;
    try {
      await navigator.clipboard.writeText(url);
      showToast(`Funnel link copied: ${url}`);
    } catch {
      showToast("Failed to copy link");
    }
  };

  if (loading || !sections) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  const selectedSectionIndex = selectedSectionId
    ? sections.findIndex((s) => s.id === selectedSectionId)
    : -1;
  const selectedSection = selectedSectionIndex >= 0 ? sections[selectedSectionIndex] : null;

  return (
    <div className="flex h-screen flex-col bg-paper font-sans text-ink">
      <div className="flex shrink-0 items-center gap-4 border-b border-line bg-panel px-4 py-3">
        <button
          className="flex h-8 w-8 items-center justify-center rounded border border-transparent hover:bg-line-soft"
          title="Back"
          onClick={() => router.push(`/dashboard/products/${productId}`)}
        >
          &larr;
        </button>
        <div className="flex flex-col leading-tight">
          <span className="text-[14.5px] font-semibold text-ink">Funnel Mode</span>
          <span className="text-[11.5px] text-muted">{saving ? "Saving..." : "Saved"}</span>
        </div>
        <div className="flex-1" />
        <button
          className="rounded-[9px] border border-line px-4 py-2 text-[13.5px] font-semibold text-ink hover:bg-line-soft"
          onClick={() => void copyFunnelLink()}
        >
          Copy funnel link
        </button>
        <button
          className={`rounded-[9px] px-4 py-2 text-[13.5px] font-semibold transition-transform hover:-translate-y-px active:translate-y-0 ${
            isPublished ? "border border-line text-ink" : "bg-accent text-accent-ink"
          }`}
          onClick={() => void handlePublishToggle()}
        >
          {isPublished ? "Turn off funnel" : "Publish funnel"}
        </button>
      </div>

      <div className="relative flex flex-1 min-h-0">
        <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-line bg-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Sections</span>
            <button
              className="rounded-md bg-ink px-2 py-0.5 text-[10.5px] font-semibold text-paper hover:opacity-80"
              onClick={() => setShowAddSection(!showAddSection)}
            >
              + Add
            </button>
          </div>

          {showAddSection && (
            <div className="mb-3 rounded-lg border border-line bg-paper p-2">
              {FUNNEL_SECTION_CATALOG.map((cat) => (
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
            {sections.map((sec, idx) => (
              <div
                key={sec.id}
                className={`flex items-center gap-2 rounded-lg px-2 py-2 ${
                  selectedSectionId === sec.id ? "bg-line-soft" : ""
                }`}
              >
                <button
                  className={`flex-1 bg-transparent p-0 text-left text-[13px] font-medium ${
                    sec.visible ? "text-ink" : "text-muted line-through"
                  }`}
                  onClick={() => setSelectedSectionId(sec.id)}
                >
                  {FUNNEL_SECTION_CATALOG.find((c) => c.kind === sec.kind)?.label ?? sec.kind}
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
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          {selectedSection ? (
            <div className="mx-auto flex max-w-lg flex-col gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {FUNNEL_SECTION_CATALOG.find((c) => c.kind === selectedSection.kind)?.label}
              </span>

              {selectedSection.kind === "funnel-hero" && (
                <>
                  <FieldInput label="Eyebrow" value={selectedSection.eyebrow || ""} onChange={(v) => updateSectionField(selectedSectionIndex, "eyebrow", v)} />
                  <FieldInput label="Headline" value={selectedSection.headline} onChange={(v) => updateSectionField(selectedSectionIndex, "headline", v)} />
                  <FieldTextarea label="Subheading" value={selectedSection.sub} onChange={(v) => updateSectionField(selectedSectionIndex, "sub", v)} />
                </>
              )}

              {(selectedSection.kind === "funnel-story" ||
                selectedSection.kind === "funnel-solution" ||
                selectedSection.kind === "funnel-guarantee") && (
                <>
                  <FieldInput label="Title" value={selectedSection.title} onChange={(v) => updateSectionField(selectedSectionIndex, "title", v)} />
                  <FieldTextarea label="Body" rows={6} value={selectedSection.body} onChange={(v) => updateSectionField(selectedSectionIndex, "body", v)} />
                </>
              )}

              {selectedSection.kind === "funnel-how-it-works" && (
                <>
                  <FieldInput label="Title" value={selectedSection.title} onChange={(v) => updateSectionField(selectedSectionIndex, "title", v)} />
                  {selectedSection.steps.map((step, i) => (
                    <div key={i} className="rounded-lg border border-line p-2">
                      <FieldInput
                        label={`Step ${i + 1} title`}
                        value={step.title}
                        onChange={(v) => {
                          const items = [...selectedSection.steps];
                          items[i] = { ...items[i]!, title: v };
                          updateSectionField(selectedSectionIndex, "steps", items);
                        }}
                      />
                      <FieldTextarea
                        label="Description"
                        value={step.body}
                        onChange={(v) => {
                          const items = [...selectedSection.steps];
                          items[i] = { ...items[i]!, body: v };
                          updateSectionField(selectedSectionIndex, "steps", items);
                        }}
                      />
                      {selectedSection.steps.length > 1 && (
                        <button
                          className="mt-1 text-[10.5px] text-red-500 hover:underline"
                          onClick={() => updateSectionField(selectedSectionIndex, "steps", selectedSection.steps.filter((_, j) => j !== i))}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  {selectedSection.steps.length < 8 && (
                    <button
                      className="rounded-md border border-dashed border-line px-3 py-1.5 text-[12px] text-muted hover:bg-line-soft"
                      onClick={() => updateSectionField(selectedSectionIndex, "steps", [...selectedSection.steps, { title: "New step", body: "" }])}
                    >
                      + Add step
                    </button>
                  )}
                </>
              )}

              {selectedSection.kind === "funnel-who-its-for" && (
                <>
                  <FieldInput label="Title" value={selectedSection.title} onChange={(v) => updateSectionField(selectedSectionIndex, "title", v)} />
                  <div className="flex flex-col gap-1">
                    <label className="text-[11.5px] text-muted">Items (one per line)</label>
                    <textarea
                      className="w-full resize-y rounded-[7px] border border-line bg-paper px-2 py-2 text-[13px] text-ink outline-none focus:border-ink"
                      rows={5}
                      value={selectedSection.items.join("\n")}
                      onChange={(e) => updateSectionField(selectedSectionIndex, "items", e.target.value.split("\n").filter(Boolean))}
                    />
                  </div>
                </>
              )}

              {selectedSection.kind === "funnel-testimonials" && (
                <>
                  <FieldInput label="Title" value={selectedSection.title} onChange={(v) => updateSectionField(selectedSectionIndex, "title", v)} />
                  {selectedSection.items.map((item, i) => (
                    <div key={i} className="rounded-lg border border-line p-2">
                      <FieldTextarea
                        label="Quote"
                        value={item.quote}
                        onChange={(v) => {
                          const items = [...selectedSection.items];
                          items[i] = { ...items[i]!, quote: v };
                          updateSectionField(selectedSectionIndex, "items", items);
                        }}
                      />
                      <FieldInput
                        label="Author"
                        value={item.author}
                        onChange={(v) => {
                          const items = [...selectedSection.items];
                          items[i] = { ...items[i]!, author: v };
                          updateSectionField(selectedSectionIndex, "items", items);
                        }}
                      />
                      {selectedSection.items.length > 1 && (
                        <button
                          className="mt-1 text-[10.5px] text-red-500 hover:underline"
                          onClick={() => updateSectionField(selectedSectionIndex, "items", selectedSection.items.filter((_, j) => j !== i))}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  {selectedSection.items.length < 10 && (
                    <button
                      className="rounded-md border border-dashed border-line px-3 py-1.5 text-[12px] text-muted hover:bg-line-soft"
                      onClick={() => updateSectionField(selectedSectionIndex, "items", [...selectedSection.items, { quote: "", author: "" }])}
                    >
                      + Add testimonial
                    </button>
                  )}
                </>
              )}

              {selectedSection.kind === "funnel-packages" && (
                <>
                  <FieldInput label="Title" value={selectedSection.title} onChange={(v) => updateSectionField(selectedSectionIndex, "title", v)} />
                  <p className="text-[11.5px] text-muted">
                    Price is the total for the whole package, not per unit.
                  </p>
                  {selectedSection.options.map((opt, i) => (
                    <div key={opt.id} className="rounded-lg border border-line p-2">
                      <FieldInput
                        label="Label"
                        value={opt.label}
                        onChange={(v) => {
                          const items = [...selectedSection.options];
                          items[i] = { ...items[i]!, label: v };
                          updateSectionField(selectedSectionIndex, "options", items);
                        }}
                      />
                      <div className="flex gap-2">
                        <div className="flex flex-1 flex-col gap-1">
                          <label className="text-[11.5px] text-muted">Quantity</label>
                          <input
                            type="number"
                            min={1}
                            className="w-full rounded-[7px] border border-line bg-paper px-2 py-2 text-[13px] text-ink outline-none focus:border-ink"
                            value={opt.quantity}
                            onChange={(e) => {
                              const items = [...selectedSection.options];
                              items[i] = { ...items[i]!, quantity: Math.max(1, parseInt(e.target.value) || 1) };
                              updateSectionField(selectedSectionIndex, "options", items);
                            }}
                          />
                        </div>
                        <div className="flex flex-1 flex-col gap-1">
                          <label className="text-[11.5px] text-muted">Total price (cents)</label>
                          <input
                            type="number"
                            min={0}
                            className="w-full rounded-[7px] border border-line bg-paper px-2 py-2 text-[13px] text-ink outline-none focus:border-ink"
                            value={opt.priceCents}
                            onChange={(e) => {
                              const items = [...selectedSection.options];
                              items[i] = { ...items[i]!, priceCents: Math.max(0, parseInt(e.target.value) || 0) };
                              updateSectionField(selectedSectionIndex, "options", items);
                            }}
                          />
                        </div>
                      </div>
                      <FieldInput
                        label="Badge (optional, e.g. Best Value)"
                        value={opt.badge || ""}
                        onChange={(v) => {
                          const items = [...selectedSection.options];
                          items[i] = { ...items[i]!, badge: v || undefined };
                          updateSectionField(selectedSectionIndex, "options", items);
                        }}
                      />
                      {selectedSection.options.length > 1 && (
                        <button
                          className="mt-1 text-[10.5px] text-red-500 hover:underline"
                          onClick={() => updateSectionField(selectedSectionIndex, "options", selectedSection.options.filter((_, j) => j !== i))}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  {selectedSection.options.length < 6 && (
                    <button
                      className="rounded-md border border-dashed border-line px-3 py-1.5 text-[12px] text-muted hover:bg-line-soft"
                      onClick={() =>
                        updateSectionField(selectedSectionIndex, "options", [
                          ...selectedSection.options,
                          { id: `pkg-${Date.now()}`, label: "New package", quantity: 1, priceCents: 0 },
                        ])
                      }
                    >
                      + Add package
                    </button>
                  )}
                </>
              )}

              {selectedSection.kind === "funnel-faq" && (
                <>
                  <FieldInput label="Title" value={selectedSection.title} onChange={(v) => updateSectionField(selectedSectionIndex, "title", v)} />
                  {selectedSection.items.map((item, i) => (
                    <div key={i} className="rounded-lg border border-line p-2">
                      <FieldInput
                        label="Question"
                        value={item.question}
                        onChange={(v) => {
                          const items = [...selectedSection.items];
                          items[i] = { ...items[i]!, question: v };
                          updateSectionField(selectedSectionIndex, "items", items);
                        }}
                      />
                      <FieldTextarea
                        label="Answer"
                        value={item.answer}
                        onChange={(v) => {
                          const items = [...selectedSection.items];
                          items[i] = { ...items[i]!, answer: v };
                          updateSectionField(selectedSectionIndex, "items", items);
                        }}
                      />
                      {selectedSection.items.length > 1 && (
                        <button
                          className="mt-1 text-[10.5px] text-red-500 hover:underline"
                          onClick={() => updateSectionField(selectedSectionIndex, "items", selectedSection.items.filter((_, j) => j !== i))}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  {selectedSection.items.length < 15 && (
                    <button
                      className="rounded-md border border-dashed border-line px-3 py-1.5 text-[12px] text-muted hover:bg-line-soft"
                      onClick={() => updateSectionField(selectedSectionIndex, "items", [...selectedSection.items, { question: "", answer: "" }])}
                    >
                      + Add question
                    </button>
                  )}
                </>
              )}

              {selectedSection.kind === "funnel-order" && (
                <>
                  <FieldInput label="Title" value={selectedSection.title} onChange={(v) => updateSectionField(selectedSectionIndex, "title", v)} />
                  <FieldInput label="Button label" value={selectedSection.ctaLabel} onChange={(v) => updateSectionField(selectedSectionIndex, "ctaLabel", v)} />
                  <p className="text-[11.5px] text-muted">
                    The order form itself (contact details, delivery, payment) is fixed and always appears here.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="mx-auto max-w-lg py-2 text-[12.5px] leading-relaxed text-muted">
              Select a section from the left to edit its content.
            </div>
          )}
        </main>
      </div>

      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-[9px] bg-ink px-4 py-2.5 text-[13px] text-paper shadow-lg">
          <span className="h-1.5 w-1.5 rounded-full bg-[#5FBF8F]" />
          {toastMessage}
        </div>
      )}
    </div>
  );
}

function FieldInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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
