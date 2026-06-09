import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };

type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[AppErrorBoundary] Render error:", error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  reload = (): void => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <>
          <div className="min-h-svh bg-background text-foreground" />
          <div
            role="alert"
            className="fixed bottom-6 right-6 z-[200] flex max-w-sm flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 shadow-lg backdrop-blur-sm dark:bg-destructive/20"
          >
            <p className="text-sm font-medium text-foreground">Something went wrong.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={this.reset}>
                Try again
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={this.reload}>
                Reload page
              </Button>
            </div>
          </div>
        </>
      );
    }

    return this.props.children;
  }
}
