import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Contains a crash to the current route instead of blanking the whole app.
 * Most pages other than /agents still depend on Supabase (supabaseClient.ts
 * throws without VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY, which are no
 * longer set) - visiting one of those is expected to fail during this
 * incremental port, but it should fail as a contained "this page isn't
 * ready yet" message, not a blank white screen with no explanation.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Route failed to load:", error);
  }

  componentDidUpdate(prevProps: Props) {
    // Reset on navigation so switching away from a broken page and back
    // (or to a different page) doesn't get stuck showing the old error.
    if (prevProps.children !== this.props.children && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, maxWidth: 640 }}>
          <h2 style={{ marginBottom: 8 }}>This page isn't available yet</h2>
          <p style={{ color: "var(--muted-foreground, #888)" }}>
            This part of Numbatrak hasn't been ported off Supabase yet, so it can't load right now.
            Try a different page from the sidebar.
          </p>
          <pre style={{ marginTop: 16, fontSize: 12, opacity: 0.6, whiteSpace: "pre-wrap" }}>
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
