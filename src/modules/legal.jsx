// ═══════════════════════════════════════════════════════════════
// legal.jsx — Política de Privacidade, Termos de Uso, Acordo de
// Tratamento de Dados e Suboperadores (versão revisada pelo advogado).
//
// Páginas públicas: /privacidade e /termos (main.jsx). O aceite do
// escritório fica no backend (empresas.termos_aceite) e tem a mesma
// versão de TERMOS_VERSAO lá: mudou o texto de forma relevante, sobe as
// duas versões juntas, e os escritórios aceitam de novo.
// ═══════════════════════════════════════════════════════════════

const LEGAL_VERSAO = "1.0";
const LEGAL_DATA = "24/10/2026";

const LEGAL_PRIVACIDADE = `## Política de Privacidade

*Última atualização: ${LEGAL_DATA}*

O VICKE é um sistema para escritórios de arquitetura e engenharia gerirem clientes, projetos, obras e finanças. Ele é oferecido por Renato Fernandes Teixeira de Barros, de Ourinhos/SP (“VICKE”, “nós”). Esta política explica quais dados pessoais tratamos, por quê, com quem compartilhamos e como você exerce seus direitos pela Lei Geral de Proteção de Dados (Lei 13.709/2018, LGPD).

### 1. Quem decide sobre os seus dados

- **Dados que um escritório coloca no VICKE** (os clientes dele, obras, fornecedores, lançamentos, comprovantes, notas, propostas): quem decide é o escritório, que é o controlador. O VICKE trata esses dados só para prestar o serviço ao escritório, seguindo as instruções dele (operador). Se você é cliente, fornecedor ou parceiro de um escritório, fale primeiro com ele; nós o ajudamos a responder.
- **Dados de quem usa o VICKE** (nome, e-mail, senha, registros de acesso dos usuários dos escritórios): aqui o VICKE é o controlador.

### 2. Quais dados tratamos

| Grupo | Exemplos | De onde vêm |
| --- | --- | --- |
| Usuários dos escritórios | nome, e-mail, nível de acesso, senha (guardada só de forma cifrada, que não pode ser revertida), data do último acesso, endereço IP e navegador em envios de arquivo e registros de segurança | o próprio usuário ou o administrador do escritório |
| Clientes dos escritórios | nome, CPF ou CNPJ, telefone, e-mail, endereço, dados do imóvel e do projeto, respostas do briefing, propostas e contratos | o escritório, ou o próprio cliente ao preencher o briefing ou acessar a obra |
| Fornecedores e prestadores | nome, CPF ou CNPJ, contato, chave PIX, pedidos, cotações e pagamentos | o escritório |
| Dados financeiros | lançamentos, extratos bancários, comprovantes, notas fiscais, boletos | o escritório |
| Mensagens | e-mails recebidos pelo endereço do VICKE e mensagens trocadas no sistema | quem envia |

Não pedimos dados pessoais sensíveis (saúde, religião, origem racial etc.). Se um escritório registrar algum, por exemplo uma necessidade de acessibilidade no briefing, ele é tratado só para o projeto, com a mesma proteção.

### 3. Para que usamos e com qual base legal

| Finalidade | Base legal (LGPD) |
| --- | --- |
| Prestar o serviço contratado pelo escritório | execução de contrato (art. 7º, V); para os dados dos clientes do escritório, a base é a que o escritório tiver |
| Login, controle de acesso e prevenção de fraude | legítimo interesse (art. 7º, IX) |
| Registros de acesso exigidos pelo Marco Civil da Internet | obrigação legal (art. 7º, II) |
| Avisos de sistema por e-mail (código de cadastro, recuperação de senha, alertas) | execução de contrato |
| Leitura automática de documentos por inteligência artificial, quando o escritório liga o recurso | execução de contrato, a pedido do escritório |

Não vendemos dados, não fazemos publicidade com eles e não os usamos para treinar modelos de inteligência artificial.

### 4. Com quem compartilhamos

Só com os fornecedores que fazem o VICKE funcionar (hospedagem, banco de dados, armazenamento de arquivos, envio de e-mail, cópia de segurança e leitura por IA), cada um limitado ao necessário. A lista atualizada está em vicke.com.br/termos, na seção Suboperadores. Também compartilhamos quando a lei ou uma ordem judicial exigir.

### 5. Transferência para fora do Brasil

Alguns desses fornecedores guardam ou processam dados fora do Brasil, principalmente nos Estados Unidos. A transferência é feita para prestar o serviço, pelo tempo do contrato, com as garantias do art. 33 da LGPD e das cláusulas-padrão da ANPD (Resolução CD/ANPD nº 19/2024). País e finalidade de cada fornecedor estão na lista de suboperadores.

### 6. Como protegemos

- Senhas guardadas só de forma cifrada e irreversível; trocar a senha encerra os acessos abertos.
- Cada escritório só enxerga os próprios dados; o cliente final só enxerga a própria obra.
- Comprovantes, notas e propostas ficam em armazenamento privado e só abrem por um link temporário, para quem tem acesso.
- Cópia de segurança diária, criptografada, guardada em outro provedor.
- Registro de quem fez cada alteração e histórico de versões para desfazer erros.

### 7. Por quanto tempo guardamos

- Enquanto o escritório for assinante. Ao fim do contrato, o escritório pode exportar tudo; depois apagamos em até 90 dias, salvo o que a lei mandar guardar.
- Cópias de segurança: as diárias somem em 30 dias e as mensais em 12 meses.
- Histórico de versões: 90 dias. Registros de segurança: 1 ano. Registros de acesso: pelo menos 6 meses (Marco Civil).

### 8. Seus direitos

Você pode pedir confirmação de que tratamos seus dados, acesso, correção, anonimização ou exclusão do que for desnecessário, portabilidade, informação sobre com quem compartilhamos, e revogar consentimento quando ele for a base (art. 18 da LGPD). Se os dados foram colocados por um escritório, encaminhamos o pedido a ele. Respondemos em até 15 dias.

### 9. Contato

Canal de privacidade: privacidade@vicke.com.br. Responsável pelo canal: Renato Fernandes Teixeira de Barros. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).

### 10. Mudanças

Quando esta política mudar de forma relevante, avisamos os escritórios por e-mail e no sistema antes de a mudança valer.`;

const LEGAL_TERMOS = `## Termos de Uso

*Versão ${LEGAL_VERSAO} — ${LEGAL_DATA}*

Estes termos regem o uso do VICKE pelo escritório que se cadastra (“Assinante”) e pelas pessoas que ele autoriza (“Usuários”). Ao concluir o cadastro, o Assinante aceita estes termos, a Política de Privacidade e o Acordo de Tratamento de Dados.

### 1. O serviço

O VICKE é um sistema na internet para gestão de clientes, orçamentos, projetos, obras, compras e finanças de escritórios. Os recursos podem mudar ao longo do tempo; mudanças que retirem funções essenciais serão avisadas com 30 dias de antecedência.

### 2. Cadastro e acesso

- O Assinante informa dados verdadeiros e mantém um administrador responsável pela conta.
- Cada Usuário tem login pessoal; senha com pelo menos 8 caracteres; não compartilhar logins.
- O Assinante define o nível de cada Usuário (administrador, editor, visualizador) e o acesso dos clientes finais, e responde pelos atos deles no sistema.
- Suspeita de acesso indevido deve ser avisada em até 24 horas pelo canal suporte@vicke.com.br.

### 3. Uso permitido

É proibido: tentar acessar dados de outro escritório; testar falhas de segurança sem autorização por escrito; enviar arquivos com vírus; usar o sistema para atividade ilegal; copiar ou revender o sistema.

### 4. Dados do Assinante

- Tudo o que o Assinante coloca no VICKE continua sendo dele. O VICKE não usa esses dados para outro fim que não seja prestar o serviço.
- O Assinante pode exportar seus dados a qualquer momento pela função de cópia (backup).
- O Assinante garante que tem base legal para colocar no sistema os dados dos seus clientes, fornecedores e parceiros. O Acordo de Tratamento de Dados (anexo) faz parte destes termos.

### 5. Preço e pagamento

O preço, a forma e a data de pagamento são os do plano escolhido no cadastro ou da proposta comercial aceita pelo Assinante. Em caso de atraso, o VICKE avisa e, depois de 15 dias, pode suspender a gravação de dados, mantendo a leitura e a exportação.

### 6. Disponibilidade e cópias de segurança

O VICKE busca estar disponível 24 horas por dia, mas pode ter paradas para manutenção ou por falhas de fornecedores. Fazemos cópia diária criptografada dos dados em outro provedor.

### 7. Responsabilidade

- O VICKE é uma ferramenta de gestão. Cálculos, orçamentos, quantitativos e leituras automáticas de documentos devem ser conferidos pelo Assinante antes de decisões técnicas, fiscais ou financeiras.
- A responsabilidade do VICKE fica limitada ao valor pago pelo Assinante nos 12 meses anteriores ao fato, salvo dolo ou culpa grave, e respeitado o Código de Defesa do Consumidor quando aplicável.

### 8. Propriedade intelectual

O sistema, a marca e os modelos padrão são do VICKE. Os projetos, propostas e documentos que o Assinante cria são do Assinante.

### 9. Fim do contrato

- O Assinante pode cancelar a qualquer momento, com aviso de 30 dias.
- O VICKE pode encerrar a conta por violação grave destes termos, com aviso.
- Após o encerramento: 30 dias para exportar; depois os dados são apagados em até 90 dias, e somem das cópias de segurança conforme elas vencem (até 12 meses).

### 10. Mudanças nos termos

Mudanças relevantes são avisadas por e-mail e no sistema com 30 dias de antecedência; continuar usando depois disso significa aceitar.

### 11. Lei e foro

Lei brasileira. Foro da comarca de Ourinhos/SP, salvo regra diferente do Código de Defesa do Consumidor.

## Anexo I — Acordo de Tratamento de Dados

Neste acordo, o Assinante é o **controlador** dos dados pessoais que coloca no VICKE e o VICKE é o **operador** (art. 39 da LGPD): trata esses dados só para prestar o serviço e segundo as instruções do Assinante.

1. **Objeto e instruções.** As instruções do Assinante são: guardar, organizar, exibir aos usuários autorizados, gerar documentos e relatórios, enviar e-mails de sistema, fazer cópias de segurança e, quando o Assinante ligar o recurso, ler documentos por inteligência artificial. Qualquer outro uso exige instrução por escrito.
2. **Dados e titulares.** Clientes, fornecedores, prestadores, parceiros e usuários do Assinante; dados de identificação, contato, imóvel e projeto, contratuais e financeiros, como descritos na Política de Privacidade.
3. **Confidencialidade.** Só quem precisa para operar o serviço tem acesso, com dever de sigilo. Hoje: Renato Fernandes Teixeira de Barros.
4. **Segurança.** O VICKE mantém as medidas descritas na Política de Privacidade (item 6) e não as reduz sem avisar.
5. **Suboperadores.** O Assinante autoriza os fornecedores da lista do Anexo II. Antes de incluir ou trocar um, o VICKE avisa com 15 dias de antecedência; o Assinante pode se opor e, não havendo acordo, cancelar sem multa. Cada suboperador assume obrigações de proteção equivalentes.
6. **Transferência internacional.** Permitida para os suboperadores da lista, nos países indicados, com as cláusulas-padrão da ANPD (Resolução CD/ANPD nº 19/2024), adotadas sem alteração.
7. **Pedidos de titulares.** Se um titular pedir algo diretamente ao VICKE sobre dados do Assinante, o VICKE encaminha ao Assinante em até 2 dias úteis e o ajuda a responder; a exportação e a edição dos dados já estão no sistema.
8. **Incidentes.** O VICKE avisa o Assinante sem demora injustificada, e em até 24 horas depois de confirmar um incidente que afete os dados dele, com o que se sabe: o que houve, quais dados e titulares, o que foi feito. Isso permite ao Assinante, como controlador, comunicar a ANPD e os titulares no prazo dele (3 dias úteis pela Resolução CD/ANPD nº 15/2024; 6 para agente de pequeno porte).
9. **Fim do contrato.** O Assinante exporta os dados em até 30 dias; depois o VICKE apaga em até 90 dias, salvo guarda exigida por lei, e eles somem das cópias de segurança conforme elas vencem (até 12 meses).
10. **Comprovação.** O VICKE fornece, quando pedido, as informações necessárias para o Assinante demonstrar o cumprimento da LGPD, incluindo a lista de suboperadores e um resumo das medidas de segurança.
11. **Responsabilidade.** Cada parte responde pelos danos que causar ao descumprir a LGPD ou este acordo, nos termos dos arts. 42 a 45 da lei.

## Anexo II — Suboperadores {#suboperadores}

| Fornecedor | O que faz no VICKE | Dados que recebe | País |
| --- | --- | --- | --- |
| Railway | servidor e banco de dados | todos os dados do sistema | EUA |
| Cloudinary | guarda comprovantes, notas, propostas, logos e imagens | arquivos enviados | EUA |
| Cloudflare (R2) | cópia de segurança diária | banco e arquivos, criptografados com chave que só o VICKE tem | fora do Brasil (localização automática do Cloudflare) |
| Vercel | entrega as telas do site | endereço IP e navegador de quem acessa | EUA (rede mundial) |
| Resend | e-mails de sistema e caixa de entrada do VICKE | e-mail, nome, conteúdo das mensagens | EUA |
| Anthropic | leitura de documentos por IA, só nos escritórios que ligam o recurso | o documento lido (orçamento, nota, comprovante) | EUA |
| Google Fonts | fonte das letras do site | endereço IP de quem acessa | EUA |
| ViaCEP | preenche endereço pelo CEP | só o CEP digitado | Brasil |

Duração: enquanto durar o contrato com o Assinante, mais o prazo de apagamento das cópias de segurança (até 12 meses).`;

// ── Texto → tela (só o que estes textos usam: títulos, listas, tabelas,
// negrito e itálico) ─────────────────────────────────────────────
function legalInline(txt, k) {
  const partes = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let ult = 0, m, i = 0;
  while ((m = re.exec(txt))) {
    if (m.index > ult) partes.push(txt.slice(ult, m.index));
    partes.push(m[1] ? <b key={k + "b" + i++}>{m[1]}</b> : <i key={k + "i" + i++}>{m[2]}</i>);
    ult = re.lastIndex;
  }
  if (ult < txt.length) partes.push(txt.slice(ult));
  return partes;
}
function TextoLegal({ texto }) {
  const linhas = String(texto || "").split("\n");
  const out = [];
  let i = 0, k = 0;
  const celulas = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  while (i < linhas.length) {
    const l = linhas[i];
    if (!l.trim()) { i++; continue; }
    const h = /^(#{2,4})\s+(.*?)(?:\s*\{#([\w-]+)\})?$/.exec(l);
    if (h) {
      const Tag = h[1].length === 2 ? "h2" : h[1].length === 3 ? "h3" : "h4";
      out.push(<Tag key={k++} id={h[3] || undefined} data-vk-legal-titulo="1"
        style={{ margin: Tag === "h2" ? "28px 0 10px" : "20px 0 8px", fontSize: Tag === "h2" ? 22 : 16, color: "#111827", scrollMarginTop: 16 }}>{h[2]}</Tag>);
      i++; continue;
    }
    if (l.trim().startsWith("|")) {
      const cab = celulas(l);
      const corpo = [];
      i += 2;
      while (i < linhas.length && linhas[i].trim().startsWith("|")) { corpo.push(celulas(linhas[i])); i++; }
      out.push(
        <div key={k++} style={{ overflowX: "auto", margin: "10px 0", border: "1px solid rgba(38,36,33,0.14)", borderRadius: 10 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, minWidth: cab.length > 2 ? 560 : 0 }}>
            <thead><tr>{cab.map((c, j) => <th key={j} style={{ textAlign: "left", padding: "8px 10px", background: "#f9fafb", borderBottom: "1px solid rgba(38,36,33,0.14)", color: "#374151" }}>{c}</th>)}</tr></thead>
            <tbody>{corpo.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j} style={{ padding: "8px 10px", borderTop: ri ? "1px solid rgba(38,36,33,0.08)" : "none", verticalAlign: "top", color: "#374151", lineHeight: 1.45 }}>{legalInline(c, "t" + ri + j)}</td>)}</tr>)}</tbody>
          </table>
        </div>);
      continue;
    }
    if (/^- /.test(l) || /^\d+\. /.test(l)) {
      const numerada = /^\d+\. /.test(l);
      const itens = [];
      while (i < linhas.length && (numerada ? /^\d+\. /.test(linhas[i]) : /^- /.test(linhas[i]))) { itens.push(linhas[i].replace(/^(- |\d+\. )/, "")); i++; }
      const Lista = numerada ? "ol" : "ul";
      out.push(<Lista key={k++} style={{ margin: "8px 0", paddingLeft: 22, lineHeight: 1.6, color: "#374151", fontSize: 14 }}>
        {itens.map((t, j) => <li key={j} style={{ marginBottom: 4 }}>{legalInline(t, "l" + j)}</li>)}</Lista>);
      continue;
    }
    out.push(<p key={k++} style={{ margin: "8px 0", lineHeight: 1.6, color: "#374151", fontSize: 14 }}>{legalInline(l, "p" + k)}</p>);
    i++;
  }
  return <div>{out}</div>;
}

// Página pública: /privacidade e /termos
function PaginaLegal({ qual }) {
  const ehTermos = qual === "termos";
  useEffect(() => {
    document.title = (ehTermos ? "Termos de Uso" : "Política de Privacidade") + " — VICKE";
    const alvo = (window.location.hash || "").slice(1);
    if (alvo) setTimeout(() => { const el = document.getElementById(alvo); if (el) el.scrollIntoView(); }, 50);
  }, [ehTermos]);
  const link = (ativo) => ({ fontSize: 13, fontWeight: ativo ? 700 : 500, color: ativo ? "#111827" : "#0474f4", textDecoration: "none" });
  return (
    <div data-vk-legal={qual} style={{ minHeight: "100vh", background: "#fafafa", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "20px 16px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
          <a href="/" style={{ fontSize: 20, fontWeight: 800, color: "#111827", textDecoration: "none", letterSpacing: 0.5 }}>VICKE</a>
          <div style={{ display: "flex", gap: 16 }}>
            <a href="/privacidade" style={link(!ehTermos)}>Privacidade</a>
            <a href="/termos" style={link(ehTermos)}>Termos de uso</a>
          </div>
        </div>
        <div style={{ background: "#fff", border: "1px solid rgba(38,36,33,0.12)", borderRadius: 16, padding: "8px 22px 22px" }}>
          <TextoLegal texto={ehTermos ? LEGAL_TERMOS : LEGAL_PRIVACIDADE} />
        </div>
      </div>
    </div>
  );
}

// Escritório já cadastrado que ainda não aceitou a versão vigente: o admin
// aceita uma vez (fica no backend com data, versão e quem aceitou). Quem
// não é admin segue usando — o aceite é da empresa.
function AvisoTermos({ usuario }) {
  const [pendente, setPendente] = useState(false);
  const [aceitou, setAceitou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const ehAdmin = usuario && usuario.perfil === "escritorio" && usuario.nivel === "admin";
  useEffect(() => {
    if (!ehAdmin || typeof api === "undefined" || !api.termos) return;
    let vivo = true;
    api.termos.situacao().then((r) => {
      if (vivo && r && (!r.aceite || r.aceite.versao !== r.versaoAtual)) setPendente(true);
    }).catch(() => {});
    return () => { vivo = false; };
  }, [ehAdmin]);
  if (!pendente) return null;
  async function aceitar() {
    if (!aceitou) { setErro("Marque que leu e aceita para continuar."); return; }
    setEnviando(true); setErro("");
    try { await api.termos.aceitar(LEGAL_VERSAO); setPendente(false); }
    catch (e) { setErro(e.message || "Não foi possível registrar o aceite."); }
    finally { setEnviando(false); }
  }
  const doc = (href, titulo, linha) => (
    <a href={href} target="_blank" rel="noopener noreferrer" data-vk-termos-doc="1"
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", border: "1px solid rgba(38,36,33,0.12)",
        borderRadius: 12, textDecoration: "none", background: "#fafafa" }}>
      <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 8, background: "#fff", border: "1px solid rgba(38,36,33,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" />
        </svg>
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "#262421" }}>{titulo}</span>
        <span style={{ display: "block", fontSize: 12, color: "#6b7280", marginTop: 1 }}>{linha}</span>
      </span>
      <span aria-hidden="true" style={{ color: "#9ca3af", fontSize: 14 }}>↗</span>
    </a>
  );
  return (
    <div data-vk-aviso-termos="1" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100040, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <div style={{ background: "#fff", border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: "24px 26px 22px", maxWidth: 460,
        width: "100%", boxShadow: "0 20px 40px rgba(0,0,0,0.15)", boxSizing: "border-box" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#0474f4", letterSpacing: 0.3, marginBottom: 6 }}>VICKE · versão {LEGAL_VERSAO}</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#262421", marginBottom: 8 }}>Termos de Uso e Privacidade</div>
        <div style={{ fontSize: 13.5, color: "#4b5563", lineHeight: 1.55, marginBottom: 16 }}>
          Publicamos as regras de uso do VICKE e de como cuidamos dos dados que o seu escritório coloca aqui.
          Como administrador, confirme o aceite em nome do escritório.
        </div>
        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          {doc("/termos", "Termos de Uso e Acordo de Tratamento de Dados", "o escritório decide sobre os dados; o VICKE só os trata para prestar o serviço")}
          {doc("/privacidade", "Política de Privacidade", "quais dados, para quê, com quem e por quanto tempo")}
        </div>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "#374151", lineHeight: 1.5, cursor: "pointer",
          padding: "10px 12px", borderRadius: 12, background: aceitou ? "#eff6ff" : "transparent", marginBottom: 14 }}>
          <input type="checkbox" data-vk-aceite-termos="1" checked={aceitou} onChange={(e) => { setAceitou(e.target.checked); setErro(""); }}
            style={{ marginTop: 3, accentColor: "#0474f4", width: 15, height: 15, flexShrink: 0 }} />
          <span>Li e aceito, em nome do escritório, os Termos de Uso, o Acordo de Tratamento de Dados e a Política de Privacidade.</span>
        </label>
        {erro && <div style={{ fontSize: 12.5, color: "#b91c1c", marginBottom: 10 }}>{erro}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
          {/* toda janela tem como sair: "agora não" volta a perguntar no próximo acesso */}
          <button type="button" data-vk-termos-depois="1" onClick={() => setPendente(false)} disabled={enviando}
            style={{ background: "#fff", color: "#4b5563", border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 12, padding: "8px 18px",
              fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            Agora não
          </button>
          <button type="button" data-vk-aceitar-termos="1" onClick={aceitar} disabled={enviando}
            style={{ background: aceitou ? "#262421" : "#a8a29e", color: "#fff", border: "none", borderRadius: 12, padding: "8px 20px",
              fontSize: 13, fontWeight: 600, cursor: aceitou ? "pointer" : "default", fontFamily: "inherit", opacity: enviando ? 0.7 : 1 }}>
            {enviando ? "Registrando…" : "Aceitar e continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}

if (typeof window !== "undefined") {
  window.PaginaLegal = PaginaLegal;
}
