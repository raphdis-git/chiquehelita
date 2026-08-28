import React, { useEffect, useState } from 'react';
import { ExternalLink, ShieldCheck, X } from 'lucide-react';
import logo from './assets/Logo.png';
import './site-footer.css';

const INSTAGRAM_URL = 'https://www.instagram.com/chiquehelita/';

function WhatsAppIcon() {
  return <svg className="brand-social-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.5L3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 20.5 11.7Z"/><path className="brand-social-fill" d="M8.1 7.5c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.8 1.9c.1.3.1.5-.1.7l-.7.9c-.2.2-.1.4 0 .6.8 1.4 1.9 2.5 3.4 3.2.3.1.5.1.7-.1l.9-1.1c.2-.2.4-.3.7-.2l1.9.9c.3.1.4.3.4.5 0 .3-.2 1.5-1.1 2.1-.6.5-1.5.7-2.3.5-1.1-.3-2.8-.9-4.7-2.6-1.5-1.4-2.6-3.1-2.9-4.3-.4-1.2 0-2.3.4-2.8l.9-.2Z"/></svg>;
}

function InstagramIcon() {
  return <svg className="brand-social-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.1"/><circle className="brand-social-dot" cx="17.4" cy="6.7" r="1"/></svg>;
}

export default function SiteFooter({ whatsapp }) {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const whatsappNumber = String(whatsapp ?? '').replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Olá! Vim pelo site da CHIQUEHELITA e gostaria de atendimento.')}`;

  useEffect(() => {
    if (!privacyOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setPrivacyOpen(false); };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [privacyOpen]);

  return <>
    <footer id="sobre" className="site-footer">
      <div className="footer-brand"><img src={logo} alt="Chique Helita"/><p>Moda feminina com elegância e personalidade.</p></div>
      <div className="footer-column"><h4>Atendimento</h4><p>Segunda a sexta-feira</p>{whatsappNumber ? <a href={whatsappUrl} target="_blank" rel="noreferrer"><WhatsAppIcon/>Falar no WhatsApp</a> : <p>WhatsApp temporariamente indisponível</p>}</div>
      <div className="footer-column"><h4>Links</h4><a href={INSTAGRAM_URL} target="_blank" rel="noreferrer"><InstagramIcon/>Instagram<ExternalLink size={13}/></a><button type="button" onClick={() => setPrivacyOpen(true)}><ShieldCheck size={17}/>Política de privacidade</button></div>
    </footer>
    {privacyOpen && <div className="privacy-modal" role="dialog" aria-modal="true" aria-labelledby="privacy-title" onClick={() => setPrivacyOpen(false)}>
      <article className="privacy-modal-content" onClick={(event) => event.stopPropagation()}>
        <header><div><p>SEGURANÇA E TRANSPARÊNCIA</p><h2 id="privacy-title">Política de Privacidade</h2></div><button type="button" onClick={() => setPrivacyOpen(false)} aria-label="Fechar Política de Privacidade" autoFocus><X size={22}/></button></header>
        <div className="privacy-copy">
          <p className="privacy-updated">Última atualização: 28 de agosto de 2026.</p>
          <section><h3>1. Dados utilizados</h3><p>Ao realizar um pedido, podemos utilizar nome, CPF ou CNPJ, telefone, e-mail quando informado e dados de endereço necessários ao atendimento, pagamento e entrega.</p></section>
          <section><h3>2. Finalidades</h3><p>Os dados são usados para registrar e acompanhar pedidos, confirmar pagamentos, calcular frete, emitir etiquetas, realizar entregas, prevenir fraudes e prestar atendimento ao cliente.</p></section>
          <section><h3>3. Serviços parceiros</h3><p>Somente quando necessário, os dados do pedido podem ser processados pelos serviços responsáveis por hospedagem, pagamento e transporte, como Supabase, InfinitePay, Melhor Envio, Correios e transportadoras selecionadas.</p></section>
          <section><h3>4. Proteção e conservação</h3><p>Adotamos medidas técnicas e administrativas para proteger os dados. As informações são mantidas pelo período necessário ao atendimento do pedido e ao cumprimento de obrigações legais e fiscais.</p></section>
          <section><h3>5. Seus direitos</h3><p>Você pode solicitar confirmação, acesso, correção ou exclusão dos seus dados, quando aplicável, entrando em contato pelo WhatsApp da loja ou pelo e-mail chiquehelita@gmail.com.</p></section>
        </div>
        <footer><button type="button" className="button" onClick={() => setPrivacyOpen(false)}>Entendi</button></footer>
      </article>
    </div>}
  </>;
}
