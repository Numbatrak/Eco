export function MissingEnvPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background: "#0f172a",
        color: "#e2e8f0",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 520 }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>
          Local environment not configured
        </h1>
        <p style={{ color: "#94a3b8", lineHeight: 1.6, marginBottom: "1rem" }}>
          This app needs Supabase credentials at startup. Production has them on
          Netlify; your machine is missing a <code>.env.local</code> file.
        </p>
        <ol style={{ color: "#cbd5e1", lineHeight: 1.8, paddingLeft: "1.25rem" }}>
          <li>
            Copy <code>.env.example</code> to <code>.env.local</code>
          </li>
          <li>
            Paste <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> from your Netlify site
            (Environment variables) or Supabase project settings
          </li>
          <li>Restart the dev server: <code>npm run dev</code></li>
        </ol>
      </div>
    </div>
  );
}
