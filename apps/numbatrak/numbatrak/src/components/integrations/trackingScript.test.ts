/**
 * Runs the pasted snippet in a DOM: it saves ?tl= from the address, fills
 * Fluent Forms / Elementor hidden fields (also ones added later), keeps the
 * code across pages, and never overwrites a value already there.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { TRACKING_SCRIPT } from "./trackingScript";

const body = TRACKING_SCRIPT.replace(/^<script>/, "").replace(/<\/script>$/, "");
const run = () => new Function(body)();
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  localStorage.clear();
  document.cookie = "numbatrak_tl=; max-age=0; path=/";
  document.body.innerHTML = "";
  history.replaceState(null, "", "/");
});

describe("tracking-link site script", () => {
  it("fills Fluent Forms and Elementor hidden fields from ?tl=", () => {
    history.replaceState(null, "", "/sink-flusher?utm_source=tiktok&tl=kayode-tiktok");
    document.body.innerHTML = `
      <input type="hidden" name="tl" id="fluent">
      <input type="hidden" name="form_fields[tl]" id="form-field-tl">
      <input type="hidden" name="other" id="other">`;
    run();
    expect((document.getElementById("fluent") as HTMLInputElement).value).toBe("kayode-tiktok");
    expect((document.getElementById("form-field-tl") as HTMLInputElement).value).toBe("kayode-tiktok");
    expect((document.getElementById("other") as HTMLInputElement).value).toBe("");
  });

  it("remembers the code on a later page without ?tl=", () => {
    history.replaceState(null, "", "/?tl=abc123");
    run();
    history.replaceState(null, "", "/checkout");
    document.body.innerHTML = `<input type="hidden" name="tl" id="f">`;
    run();
    expect((document.getElementById("f") as HTMLInputElement).value).toBe("abc123");
  });

  it("fills a form that appears after the page loads", async () => {
    history.replaceState(null, "", "/?tl=popup1");
    run();
    const input = document.createElement("input");
    input.name = "form_fields[tl]";
    document.body.appendChild(input);
    await tick();
    expect(input.value).toBe("popup1");
  });

  it("leaves a value already set, and does nothing with no code", () => {
    document.body.innerHTML = `<input name="tl" id="f" value="from-server">`;
    history.replaceState(null, "", "/?tl=new");
    run();
    expect((document.getElementById("f") as HTMLInputElement).value).toBe("from-server");

    localStorage.clear();
    document.cookie = "numbatrak_tl=; max-age=0; path=/";
    history.replaceState(null, "", "/");
    document.body.innerHTML = `<input name="tl" id="g">`;
    run();
    expect((document.getElementById("g") as HTMLInputElement).value).toBe("");
  });
});
