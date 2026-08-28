import React, { useEffect, useState } from 'react';
import { AtSign, ExternalLink, MessageCircle, ShieldCheck, X } from 'lucide-react';
import logo from './assets/Logo.png';
import './site-footer.css';

const INSTAGRAM_URL = 'https://www.instagram.com/chiquehelita/';

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
      <div className="footer-column"><h4>Atendimento</h4><p>Segunda a sexta-feira</p>{whatsappNumber ? <a href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={17}/>Falar no WhatsApp</a> : <p>WhatsApp temporariamente indisponível</p>}</div>
      <div className="footer-column"><h4>Links</h4><a href={INSTAGRAM_URL} target="_blank" rel="noreferrer"><AtSign size={17}/>Instagram<ExternalLink size={13}/></a><button type="button" onClick={() => setPrivacyOpen(true)}><ShieldCheck size={17}/>Política de privacidade</button></div>
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
