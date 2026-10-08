/* eslint-disable react-refresh/only-export-components -- main.jsx é a entrada, não há fast refresh a preservar aqui */
import { StrictMode, Component, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// ═══════════════════════════════════════════════════════════════
// TELA BRANCA — as duas proteções que faltavam
//
// O guarda do index.html só cuida de quando o app NÃO SOBE. Duas outras
// situações também terminavam em tela branca, sem dizer nada:
//
// 1. Aba aberta durante um deploy: ela continua com a versão antiga, que
//    pode tropeçar em dado gravado pela nova. Aqui se compara, de tempos em
//    tempos e ao voltar para a aba, o script que está rodando com o que o
//    servidor publica; mudou, aparece "Saiu uma versão nova — Atualizar".
//    Não recarrega sozinho: pode haver um formulário pela metade.
// 2. Erro numa tela: o React desmonta tudo e sobra o branco. O
//    GuardaDeTela segura o erro, mostra o que houve e oferece recarregar.
//    Se o erro veio de versão velha (o servidor já publicou outra),
//    recarrega uma vez sozinho — é o caso em que recarregar resolve.
// ═══════════════════════════════════════════════════════════════

// "index-BabbysH-.js" — o nome muda a cada build. Em desenvolvimento não há
// esse arquivo, e as duas checagens ficam desligadas.
function scriptRodando() {
  const s = Array.from(document.scripts).map((x) => x.src || '').find((u) => /\/assets\/index-[^/]+\.js/.test(u))
  return s ? s.replace(/^.*\/assets\//, '') : ''
}

async function scriptPublicado() {
  const r = await fetch('/?v=' + Date.now(), { cache: 'no-store' })
  const t = await r.text()
  const m = t.match(/\/assets\/(index-[^"']+\.js)/)
  return m ? m[1] : ''
}

class GuardaDeTela extends Component {
  constructor(props) {
    super(props)
    this.state = { erro: null }
  }
  static getDerivedStateFromError(erro) {
    return { erro }
  }
  componentDidCatch(erro, info) {
    console.error('[vicke] a tela caiu:', erro, info && info.componentStack)
    const atual = scriptRodando()
    if (!atual) return
    scriptPublicado().then((novo) => {
      if (!novo || novo === atual) return
      let ja = null
      try { ja = sessionStorage.getItem('vicke-recarga-versao') } catch { ja = novo }
      if (ja === novo) return
      try { sessionStorage.setItem('vicke-recarga-versao', novo) } catch { /* sem storage: não arrisca laço */ return }
      location.reload()
    }).catch(() => {})
  }
  render() {
    const erro = this.state.erro
    if (!erro) return this.props.children
    const bt = { border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#f9fafb', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}>
        <div style={{ background: '#fff', border: '1px solid rgba(38,36,33,0.12)', borderRadius: 14, padding: 20, maxWidth: 440, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Esta tela parou</div>
          <div style={{ fontSize: 13, color: '#4b5563', marginTop: 6 }}>
            Nada foi perdido do que já estava gravado. Recarregue para continuar; se acontecer de novo, mande um print desta mensagem.
          </div>
          <div style={{ fontSize: 11.5, color: '#6b7280', background: '#f3f4f6', borderRadius: 8, padding: '8px 10px', marginTop: 12, wordBreak: 'break-word', fontFamily: 'ui-monospace, monospace' }}>
            {String((erro && erro.message) || erro)}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button type="button" style={{ ...bt, background: '#0474f4', color: '#fff' }} onClick={() => location.reload()}>Recarregar</button>
            <button type="button" style={{ ...bt, background: '#fff', color: '#111827', border: '1.5px solid rgba(38,36,33,0.16)' }}
              onClick={() => { location.href = '/' }}>Voltar ao início</button>
          </div>
        </div>
      </div>
    )
  }
}

function AvisoDeVersaoNova() {
  const [nova, setNova] = useState(false)
  useEffect(() => {
    const atual = scriptRodando()
    if (!atual) return undefined
    let vivo = true
    const checar = () => {
      scriptPublicado().then((v) => { if (vivo && v && v !== atual) setNova(true) }).catch(() => {})
    }
    const aoVoltar = () => { if (document.visibilityState === 'visible') checar() }
    const id = setInterval(checar, 5 * 60 * 1000)
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('focus', aoVoltar)
    return () => {
      vivo = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('focus', aoVoltar)
    }
  }, [])
  if (!nova) return null
  return (
    <div data-vk-versao-nova="1" style={{ position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 3000, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto', background: '#111827', color: '#fff', borderRadius: 12, padding: '10px 12px 10px 16px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', boxShadow: '0 12px 30px -12px rgba(17,24,39,0.5)', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, maxWidth: 520 }}>
        <span>Saiu uma versão nova do Vicke. Salve o que estiver fazendo e atualize.</span>
        <button type="button" onClick={() => location.reload()}
          style={{ border: 'none', borderRadius: 9, padding: '7px 14px', background: '#0474f4', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>Atualizar</button>
      </div>
    </div>
  )
}

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
  return (
    <GuardaDeTela>
      <App />
      <AvisoDeVersaoNova />
    </GuardaDeTela>
  );
}

// StrictMode só pra App normal (não pra rota de render).
const reactTree = isRenderRoute
  ? <RouteSwitch />
  : <StrictMode><RouteSwitch /></StrictMode>;

createRoot(document.getElementById('root')).render(reactTree);

// Sinaliza pro guarda de tela branca do index.html que o app subiu, e limpa a
// marca da recarga automática (senão a próxima tela branca não recarregaria).
window.__vickeMontou = true;
try { sessionStorage.removeItem('vicke-recarga-branca'); } catch (e) {}
