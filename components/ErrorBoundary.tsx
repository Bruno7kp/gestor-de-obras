import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  private handleReset = () => {
    // Limpar localStorage
    localStorage.clear();
    // Recarregar a página
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-12 max-w-2xl w-full border border-slate-200 dark:border-slate-800">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-rose-100 dark:bg-rose-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-3">
                Ops! Algo deu errado
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mb-8">
                O ProMeasure encontrou um erro inesperado. Isso pode ser causado por dados corrompidos no navegador.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-6 mb-8 text-left">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">
                Detalhes do Erro
              </h2>
              <pre className="text-xs text-rose-600 dark:text-rose-400 overflow-auto max-h-48 font-mono">
                {this.state.error?.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </div>

            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all"
              >
                Limpar Dados e Reiniciar
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full py-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-sm font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
              >
                Recarregar Página
              </button>
            </div>

            <p className="text-xs text-slate-400 text-center mt-8">
              Se o problema persistir, entre em contato com o suporte.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}