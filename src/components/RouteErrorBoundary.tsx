import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Errore schermata:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="mx-auto max-w-md space-y-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-center"
          role="alert"
        >
          <h2 className="text-lg font-semibold text-red-900">
            Qualcosa è andato storto
          </h2>
          <p className="text-sm text-red-800">
            L&apos;app ha riscontrato un errore su questa schermata. Puoi
            riprovare o tornare all&apos;agenda.
          </p>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => this.setState({ error: null })}
          >
            Riprova
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
