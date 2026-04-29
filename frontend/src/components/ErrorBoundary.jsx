import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  reset = () => {
    this.setState({ error: null, errorInfo: null })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6 max-w-2xl">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-red-700 mb-2">⚠ Algo falló al renderizar esta página</h2>
            <p className="text-sm text-red-600 mb-3">
              No se pudo mostrar el contenido. Esto evita que toda la app se quede en blanco.
            </p>
            <details className="text-xs text-gray-700 mb-4">
              <summary className="cursor-pointer text-gray-500 mb-2">Ver detalles técnicos</summary>
              <pre className="bg-white p-3 rounded border border-gray-200 overflow-auto whitespace-pre-wrap">
                {String(this.state.error?.message || this.state.error)}
                {this.state.errorInfo?.componentStack || ''}
              </pre>
            </details>
            <div className="flex gap-2">
              <button onClick={this.reset}
                className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg">
                Reintentar
              </button>
              <button onClick={() => window.location.href = '/'}
                className="border border-gray-200 text-sm px-4 py-2 rounded-lg hover:bg-gray-50">
                Volver al inicio
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
