
import React, { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { buildWhatsAppMessage, validateCustomer } from './data/order';

const initialCustomer = { name: '', city: '', state: '', fulfillment: 'delivery', payment: '', notes: '' };

export default function CheckoutForm({ whatsapp, lines, summary, money }) {
  const [customer, setCustomer] = useState(initialCustomer);
  const [errors, setErrors] = useState({});
  const update = (field, value) => setCustomer((current) => ({ ...current, [field]: value }));

  function submit(event) {
    event.preventDefault();
    const nextErrors = validateCustomer(customer);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const message = buildWhatsAppMessage({ customer, lines, summary, money });
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  }

  return <form className="checkout-form" onSubmit={submit} noValidate>
    <div className="checkout-heading"><strong>Dados para finalizar</strong><span>Preencha para gerar seu pedido no WhatsApp.</span></div>
    <label>Nome completo<input value={customer.name} onChange={(event) => update('name', event.target.value)} autoComplete="name" aria-invalid={Boolean(errors.name)}/>{errors.name && <small>{errors.name}</small>}</label>
    <div className="checkout-location">
      <label>Cidade<input value={customer.city} onChange={(event) => update('city', event.target.value)} autoComplete="address-level2" aria-invalid={Boolean(errors.city)}/>{errors.city && <small>{errors.city}</small>}</label>
      <label>UF<input value={customer.state} onChange={(event) => update('state', event.target.value.slice(0, 2))} autoComplete="address-level1" maxLength="2" placeholder="GO" aria-invalid={Boolean(errors.state)}/>{errors.state && <small>{errors.state}</small>}</label>
    </div>
    <label>Como deseja receber?<select value={customer.fulfillment} onChange={(event) => update('fulfillment', event.target.value)}><option value="delivery">Entrega — frete a combinar</option><option value="pickup">Retirada — detalhes a combinar</option></select></label>
    <label>Forma de pagamento<select value={customer.payment} onChange={(event) => update('payment', event.target.value)} aria-invalid={Boolean(errors.payment)}><option value="">Selecione</option><option>Pix</option><option>Cartão</option><option>Dinheiro</option><option>A combinar</option></select>{errors.payment && <small>{errors.payment}</small>}</label>
    <label>Observações (opcional)<textarea rows="2" value={customer.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Ex.: preferência de horário ou dúvida sobre o tamanho"/></label>
    <p className="checkout-privacy">Seus dados serão usados somente para montar a mensagem e não ficam armazenados no site.</p>
    <button className="button full" type="submit"><MessageCircle size={18}/> Finalizar pelo WhatsApp</button>
  </form>;
}

