import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// ═══════════════════════════════════════════════════════════════
// ROTEAMENTO DE NÍVEL ZERO
//
// O VICKE não usa React Router — o app principal é state-based
// (state `aba` decide qual módulo aparece). Mas precisamos de UMA rota
// alternativa pra geração de PDF via Puppeteer:
//
//   /render-pdf/{uuid}?token=xxx → SPA mínima que renderiza só a
//                                  PropostaPreview, sem sidebar/header.
//
// Decidimos detectar a URL aqui no main.jsx (antes de carregar o App
// inteiro), pra não impactar o fluxo normal:
//
//   - Se path começa com /render-pdf/  → renderiza <RenderPdfRoute/>
//   - Caso contrário                   → renderiza <App/> normal
//
// A função RenderPdfRoute é definida em src/modules/render-pdf-route.jsx
// e exposta via window.RenderPdfRoute (último bloco do combine.js).
// O import de App.jsx (que importa AppCombined.jsx) já carrega esse
// bundle, então window.RenderPdfRoute estará disponível antes do
// createRoot.render rodar.
//
// Vercel rewrite (vercel.json) garante que /render-pdf/* serve o
// index.html e o JS roda aqui.
// ═══════════════════════════════════════════════════════════════

const path = window.location.pathname || "";
const isRenderRoute = path.startsWith("/render-pdf/");

// Componente wrapper — captura window.RenderPdfRoute como variável local
// pra JSX poder usar.
function RouteSwitch() {
  if (isRenderRoute) {
    const RenderPdfRoute = window.RenderPdfRoute;
    if (!RenderPdfRoute) {
      return (
        <div style={{ padding: 20, fontFamily: 'sans-serif', color: '#b91c1c' }}>
          Erro: rota de render não disponível neste bundle. Verifique build.
        </div>
      );
    }
    // Sem StrictMode aqui: Puppeteer captura uma vez só, e StrictMode
    // faria 2 renders desnecessários.
    return <RenderPdfRoute />;
  }
  return <App />;
}

// StrictMode só pra App normal (não pra rota de render).
const reactTree = isRenderRoute
  ? <RouteSwitch />
  : <StrictMode><RouteSwitch /></StrictMode>;

createRoot(document.getElementById('root')).render(reactTree);
