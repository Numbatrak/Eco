import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Custom fallback content, for boundaries scoped around one known-not-
   * ready widget (e.g. ActivityFeed) rather than a whole route - avoids the
   * default's route-level "something went wrong" framing reading like a
   * bigger deal than "this one widget isn't available yet". */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Contains a crash to the current route (or, when scoped tightly around a
 * single widget, to just that widget) instead of blanking everything above
 * it. Some pages/widgets still depend on Supabase (supabaseClient.ts throws
 * without VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY, which are no longer set)
 * - visiting/rendering one of those is expected to fail during this
 * incremental port, but it should fail as a contained, honest message, not a
 * blank white screen with no explanation.
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
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{ padding: 32, maxWidth: 640 }}>
          <h2 style={{ marginBottom: 8 }}>Something went wrong loading this page</h2>
          <p style={{ color: "var(--muted-foreground, #888)" }}>
            Try a different page from the sidebar, or refresh and try again.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
