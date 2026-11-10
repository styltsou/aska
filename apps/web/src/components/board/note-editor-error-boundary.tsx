import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
  noteId: string;
};

type State = { error: Error | undefined; noteId: string };

/** Keeps a rich-text parsing or extension failure scoped to its note drawer. */
export class NoteEditorErrorBoundary extends Component<Props, State> {
  state: State = { error: undefined, noteId: this.props.noteId };

  static getDerivedStateFromError(error: Error): Pick<State, "error"> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): State | null {
    return props.noteId === state.noteId
      ? null
      : { noteId: props.noteId, error: undefined };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unable to render note editor", error, info);
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
