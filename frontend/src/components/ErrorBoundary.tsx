import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  fallback?: ReactNode
}

type State = { hasError: boolean; message: string }

/** Prevent one panel/widget crash from blanking the whole desktop. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'Unknown error' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI crashed', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="grid h-full place-items-center gap-2 p-6 text-center text-sm text-muted">
            <div>Something went wrong. Close this window and try again.</div>
            {this.state.message ? <div className="max-w-md break-words text-xs text-rose-500">{this.state.message}</div> : null}
            <button
              type="button"
              className="btn-ghost !text-xs"
              onClick={() => this.setState({ hasError: false, message: '' })}
            >
              Retry
            </button>
          </div>
        )
      )
    }
    return this.props.children
  }
}
