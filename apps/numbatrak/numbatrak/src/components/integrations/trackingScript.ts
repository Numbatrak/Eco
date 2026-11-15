/**
 * The snippet a business pastes into its website's custom code so orders
 * are credited to the right ad. It:
 *  - saves the `tl` code from the address when a visitor arrives from an
 *    ad (30 days, last ad wins), so it survives browsing to another page
 *    before ordering;
 *  - fills every hidden `tl` field with it: Fluent Forms (`name="tl"`),
 *    Elementor (`name="form_fields[tl]"`, `id="form-field-tl"`) or any
 *    field marked `data-numbatrak="tl"`, including forms that appear
 *    later (popups, multi-step forms).
 *
 * Plain ES5 on purpose: it runs on whatever browsers the business's
 * customers use, and is pasted as-is, so no build step touches it.
 */
export const TRACKING_SCRIPT = `<script>
/* NumbaTrak: remembers the ad's tracking code (?tl=) and fills hidden "tl" form fields. */
(function () {
  var KEY = "numbatrak_tl", DAYS = 30, MS = DAYS * 864e5;

  function save(code) {
    try { localStorage.setItem(KEY, JSON.stringify({ c: code, t: Date.now() })); } catch (e) {}
    document.cookie = KEY + "=" + encodeURIComponent(code) + ";path=/;max-age=" + DAYS * 86400 + ";SameSite=Lax";
  }

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && s.c && Date.now() - s.t < MS) return s.c;
    } catch (e) {}
    var m = /(?:^|;\\s*)numbatrak_tl=([^;]+)/.exec(document.cookie);
    return m ? decodeURIComponent(m[1]) : null;
  }

  var match = /[?&]tl=([^&#]*)/.exec(window.location.search);
  var fromUrl = match ? decodeURIComponent(match[1].replace(/\\+/g, " ")).trim() : "";
  if (fromUrl) save(fromUrl);
  var code = fromUrl || load();
  if (!code) return;

  function isTrackingField(el) {
    var name = el.getAttribute("name") || "", id = el.id || "";
    return name === "tl" || /\\[tl\\]$/.test(name) || id === "tl" || id === "form-field-tl" ||
      el.getAttribute("data-numbatrak") === "tl";
  }

  function fill() {
    var inputs = document.getElementsByTagName("input");
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      if (isTrackingField(el) && !el.value) {
        el.value = code;
        el.setAttribute("value", code);
      }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fill);
  else fill();
  if (window.MutationObserver) {
    /* Pasted twice? Only the latest copy keeps watching. */
    if (window.__numbatrakTl) window.__numbatrakTl.disconnect();
    window.__numbatrakTl = new MutationObserver(fill);
    window.__numbatrakTl.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
</script>`;
