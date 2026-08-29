import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in YouFi app component tree:', error, errorInfo);
  }

  private handleReset = () => {
    // Clear potentially corrupted local session flags if needed
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-gray-100 flex flex-col items-center">
            <div className="w-16 h-16 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-center text-amber-600 mb-4 shadow-sm">
              <AlertTriangle size={32} />
            </div>
            
            <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              YouFi encountered an unexpected issue while rendering this page. You can reload the app to continue.
            </p>

            <button
              onClick={this.handleReset}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 px-6 rounded-2xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <RefreshCw size={18} />
              <span>Reload YouFi</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
