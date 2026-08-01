import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

class AppErrorBoundary extends Component {
  state={error:null}
  static getDerivedStateFromError(error){return {error}}
  render(){
    if(this.state.error)return <main style={{fontFamily:'system-ui',maxWidth:680,margin:'64px auto',padding:24}}><h1>No fue posible iniciar Gastro Suite</h1><p>Actualiza la pagina. Si el problema continua, comparte este detalle con soporte:</p><pre style={{whiteSpace:'pre-wrap',background:'#fff3ed',padding:16,borderRadius:12}}>{this.state.error.message}</pre></main>
    return this.props.children
  }
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`))
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </StrictMode>,
)
