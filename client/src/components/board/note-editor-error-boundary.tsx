import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
  noteId: string;
};

type State = { error: Error | undefined };

/** Keeps a rich-text parsing or extension failure scoped to its note drawer. */
export class NoteEditorErrorBoundary extends Component<Props, State> {
  state: State = { error: undefined };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unable to render note editor", error, info);
  }

  componentDidUpdate(previousProps: Props) {
    if (previousProps.noteId !== this.props.noteId && this.state.error) {
      this.setState({ error: undefined });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="space-y-3 py-14 text-sm">
        <div>
          <p className="font-medium">Couldn’t open this note</p>
          <p className="mt-1 text-muted-foreground">
            The editor ran into a problem while loading it.
          </p>
        </div>
        <Button size="sm" onClick={() => this.setState({ error: undefined })}>
          Try again
        </Button>
      </div>
    );
  }
}
