import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Calculator, MessageCircle, Truck } from 'lucide-react';
import { buildWhatsAppMessage, formatPhone, formatTaxId, validateCustomer } from './data/order';
import { supabase } from './lib/supabase';

const initialCustomer = { name: '', email: '', taxId: '', phone: '', address: '', addressNumber: '', district: '', city: '', state: '', postalCode: '', fulfillment: '', payment: '', notes: '' };
const onlyDigits = (value, maxLength) => value.replace(/\D/g, '').slice(0, maxLength);
const draftKey = 'chiquehelita-checkout-draft';
const stepFields = [['name', 'email', 'taxId', 'phone'], ['address', 'addressNumber', 'district', 'city', 'state', 'postalCode', 'fulfillment', 'shipping'], ['payment', 'notes']];

function savedCustomer() {
  try { return { ...initialCustomer, ...JSON.parse(sessionStorage.getItem(draftKey) || '{}') }; }
  catch { return initialCustomer; }
}

export default function CheckoutForm({ whatsapp, lines, summary, money, onCompleted, onCancel }) {
  const [step, setStep] = useState(0);
  const [customer, setCustomer] = useState(savedCustomer);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [shippingOptions, setShippingOptions] = useState([]);
  const [selectedShipping, setSelectedShipping] = useState(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState('');
  const [postalCodeLoading, setPostalCodeLoading] = useState(false);
  const [postalCodeError, setPostalCodeError] = useState('');
  const [postalCodeResolved, setPostalCodeResolved] = useState(false);
  const update = (field, value) => setCustomer((current) => ({ ...current, [field]: value }));
  const updatePostalCode = (value) => {
    const postalCode = onlyDigits(value, 8);
    setPostalCodeResolved(false);
    setCustomer((current) => current.postalCode === postalCode ? current : ({
      ...current, postalCode, address: '', addressNumber: '', district: '', city: '', state: '',
    }));
  };
  const payloadLines = lines.map((line) => ({ productId: line.product.id, variantId: line.variant.id, size: line.size.label, quantity: line.quantity }));
  const orderTotal = summary.total + (selectedShipping?.price ?? 0);

  useEffect(() => { sessionStorage.setItem(draftKey, JSON.stringify(customer)); }, [customer]);
  useEffect(() => { setShippingOptions([]); setSelectedShipping(null); setShippingError(''); }, [customer.postalCode, customer.fulfillment, lines]);
  useEffect(() => {
    if (!/^\d{8}$/.test(customer.postalCode)) { setPostalCodeError(''); setPostalCodeLoading(false); setPostalCodeResolved(false); return undefined; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPostalCodeLoading(true); setPostalCodeError('');
      try {
        const response = await fetch(`https://viacep.com.br/ws/${customer.postalCode}/json/`, { signal: controller.signal });
        if (!response.ok) throw new Error('lookup_failed');
        const address = await response.json();
        if (address.erro) { setPostalCodeResolved(false); setPostalCodeError('CEP não encontrado. Confira os números informados.'); return; }
        setCustomer((current) => ({
          ...current,
          address: address.logradouro || '',
          district: address.bairro || '',
          city: address.localidade || '',
          state: address.uf || '',
        }));
        setErrors((current) => ({ ...current, postalCode: undefined, address: undefined, district: undefined, city: undefined, state: undefined }));
        setPostalCodeResolved(Boolean(address.localidade && address.uf));
      } catch (error) {
        if (error.name !== 'AbortError') { setPostalCodeResolved(false); setPostalCodeError('Não foi possível consultar o CEP agora. Preencha o endereço manualmente.'); }
      } finally {
        if (!controller.signal.aborted) setPostalCodeLoading(false);
      }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [customer.postalCode]);

  function validateStep(targetStep) {
    const allErrors = validateCustomer(customer);
    if (customer.fulfillment === 'delivery' && !selectedShipping) allErrors.shipping = 'Calcule e escolha uma opção de entrega.';
    const visibleErrors = Object.fromEntries(Object.entries(allErrors).filter(([field]) => stepFields[targetStep].includes(field)));
    setErrors(visibleErrors);
    return Object.keys(visibleErrors).length === 0;
  }

  function nextStep() {
    if (!validateStep(step)) return;
    setStep((current) => Math.min(2, current + 1));
  }

  async function calculateShipping() {
    if (!/^\d{8}$/.test(customer.postalCode)) { setShippingError('Informe os 8 números do CEP antes de calcular.'); return; }
    setShippingLoading(true); setShippingError('');
    const destinationAddress = {
      address: customer.address, number: customer.addressNumber, district: customer.district,
      city: customer.city, state: customer.state,
    };
    const { data, error } = await supabase.functions.invoke('calculate-shipping', { body: { postalCode: customer.postalCode, destinationAddress, lines: payloadLines } });
    let errorMessage = data?.error;
    if (!errorMessage && error?.context instanceof Response) {
      const responseBody = await error.context.clone().json().catch(() => null);
      errorMessage = responseBody?.error;
    }
    if (error || !data?.options?.length) { setShippingError(errorMessage || 'Não foi possível calcular o frete. Tente novamente.'); setShippingOptions([]); }
    else setShippingOptions(data.options);
    setShippingLoading(false);
  }

  async function submit(event) {
    event.preventDefault();
    const nextErrors = validateCustomer(customer);
    if (customer.fulfillment === 'delivery' && !selectedShipping) nextErrors.shipping = 'Calcule e escolha uma opção de entrega.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { setStep(Math.max(0, stepFields.findIndex((fields) => fields.some((field) => nextErrors[field])))); return; }
    setSubmitting(true); setSubmitError('');
    const shipping = selectedShipping ? { provider: selectedShipping.provider, serviceId: selectedShipping.serviceId } : null;
    const { data, error } = await supabase.functions.invoke('submit-order', { body: { customer, lines: payloadLines, shipping } });
    if (error || !data?.orderNumber) { setSubmitError(data?.error || 'Não foi possível registrar o pedido. Tente novamente.'); setSubmitting(false); return; }
    const message = buildWhatsAppMessage({ customer, lines, summary, money, orderNumber: data.orderNumber, shipping: data.shipping, productsAmount: data.productsAmount, totalAmount: data.totalAmount });
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    sessionStorage.removeItem(draftKey);
    onCompleted?.({ orderNumber: data.orderNumber });
    setSubmitting(false);
  }

  return <form className="checkout-form checkout-steps" onSubmit={submit} noValidate>
    <nav className="checkout-progress" aria-label="Etapas do checkout">{['Seus dados', 'Entrega', 'Revisão'].map((label, index) => <div key={label} className={index === step ? 'active' : index < step ? 'completed' : ''}><span>{index < step ? '✓' : index + 1}</span><strong>{label}</strong></div>)}</nav>

    {step === 0 && <section className="checkout-step"><div className="checkout-heading"><strong>Seus dados</strong><span>Precisamos dessas informações para identificar e preparar seu pedido.</span></div><div className="checkout-fields">
      <label>Nome completo<input required value={customer.name} onChange={(event) => update('name', event.target.value)} autoComplete="name" aria-invalid={Boolean(errors.name)}/>{errors.name && <small>{errors.name}</small>}</label>
      <label>E-mail <span>(opcional)</span><input type="email" value={customer.email} onChange={(event) => update('email', event.target.value)} autoComplete="email" aria-invalid={Boolean(errors.email)}/>{errors.email && <small>{errors.email}</small>}</label>
      <label>CPF ou CNPJ <span>(formatação automática)</span><input required inputMode="numeric" value={customer.taxId} onChange={(event) => update('taxId', formatTaxId(event.target.value))} maxLength="18" placeholder="000.000.000-00" aria-invalid={Boolean(errors.taxId)}/>{errors.taxId && <small>{errors.taxId}</small>}</label>
      <label>Telefone <span>(com DDD)</span><input required type="tel" inputMode="numeric" value={customer.phone} onChange={(event) => update('phone', formatPhone(event.target.value))} autoComplete="tel" maxLength="15" placeholder="(62) 99999-9999" aria-invalid={Boolean(errors.phone)}/>{errors.phone && <small>{errors.phone}</small>}</label>
    </div></section>}

    {step === 1 && <section className="checkout-step"><div className="checkout-heading"><strong>Entrega</strong><span>Digite o CEP para preenchermos o endereço automaticamente.</span></div><div className="checkout-fields">
      <label className="wide checkout-postal-code">CEP <span>(somente números)</span><input required inputMode="numeric" value={customer.postalCode} onChange={(event) => updatePostalCode(event.target.value)} autoComplete="postal-code" placeholder="00000000" aria-invalid={Boolean(errors.postalCode || postalCodeError)}/>{postalCodeLoading && <small className="postal-code-status">Consultando endereço...</small>}{postalCodeError && <small>{postalCodeError}</small>}{errors.postalCode && !postalCodeError && <small>{errors.postalCode}</small>}</label>
      <label className="wide">Endereço (rua/avenida)<input required value={customer.address} onChange={(event) => update('address', event.target.value)} autoComplete="address-line1" aria-invalid={Boolean(errors.address)}/>{errors.address && <small>{errors.address}</small>}</label>
      <label>Quadra / lote / número<input required value={customer.addressNumber} onChange={(event) => update('addressNumber', event.target.value)} autoComplete="address-line2" placeholder="Número ou S/N" aria-invalid={Boolean(errors.addressNumber)}/>{errors.addressNumber && <small>{errors.addressNumber}</small>}</label>
      <label>Bairro/setor<input required value={customer.district} onChange={(event) => update('district', event.target.value)} aria-invalid={Boolean(errors.district)}/>{errors.district && <small>{errors.district}</small>}</label>
      <label>Cidade<input required value={customer.city} onChange={(event) => update('city', event.target.value)} autoComplete="address-level2" readOnly={postalCodeResolved} aria-invalid={Boolean(errors.city)}/>{errors.city && <small>{errors.city}</small>}</label>
      <label>UF<input required value={customer.state} onChange={(event) => update('state', event.target.value.toUpperCase().slice(0, 2))} maxLength="2" placeholder="GO" readOnly={postalCodeResolved} aria-invalid={Boolean(errors.state)}/>{errors.state && <small>{errors.state}</small>}</label>
      <label>Como deseja receber?<select required value={customer.fulfillment} onChange={(event) => update('fulfillment', event.target.value)} aria-invalid={Boolean(errors.fulfillment)}><option value="">Selecione</option><option value="delivery">Entrega no endereço informado</option><option value="pickup">Retirada — detalhes a combinar</option></select>{errors.fulfillment && <small>{errors.fulfillment}</small>}</label>
    </div>{customer.fulfillment === 'delivery' && <section className="shipping-quote" aria-label="Opções de frete"><div className="shipping-quote-heading"><div><Truck size={20}/><span><strong>Frete para seu CEP</strong><small>Valores e prazos calculados automaticamente</small></span></div><button type="button" onClick={calculateShipping} disabled={shippingLoading}><Calculator size={16}/>{shippingLoading ? 'Calculando...' : shippingOptions.length ? 'Recalcular' : 'Calcular frete'}</button></div>{shippingError && <p className="checkout-error">{shippingError}</p>}{shippingOptions.length > 0 && <div className="shipping-options">{shippingOptions.map((option) => { const checked = selectedShipping?.serviceId === option.serviceId; const deadline = option.deliveryMinDays === option.deliveryMaxDays ? `${option.deliveryMaxDays} dias úteis` : `${option.deliveryMinDays} a ${option.deliveryMaxDays} dias úteis`; return <label key={option.serviceId} className={checked ? 'shipping-option selected' : 'shipping-option'}><input type="radio" name="shipping" checked={checked} onChange={() => { setSelectedShipping(option); setErrors((current) => ({ ...current, shipping: undefined })); }}/><span><strong>{option.company} · {option.serviceName}</strong><small>Entrega estimada em {deadline}</small></span><b>{money(option.price)}</b></label>; })}</div>}{errors.shipping && <small className="shipping-validation">{errors.shipping}</small>}</section>}</section>}

    {step === 2 && <section className="checkout-step"><div className="checkout-heading"><strong>Revise seu pedido</strong><span>Confira tudo antes de finalizar pelo WhatsApp.</span></div><div className="checkout-review-items">{lines.map((line) => <article key={`${line.product.id}-${line.variant.id}-${line.size.label}`}><span>{line.quantity}x {line.product.name}<small>{line.variant.color} · {line.variant.printPattern} · Tam. {line.size.label}</small></span></article>)}</div><div className="checkout-review-address"><strong>{customer.name}</strong><span>{customer.address}, {customer.addressNumber} · {customer.district}</span><span>{customer.city}/{customer.state} · CEP {customer.postalCode}</span><button type="button" onClick={() => setStep(1)}>Alterar entrega</button></div><div className="checkout-fields"><label>Forma de pagamento<select required value={customer.payment} onChange={(event) => update('payment', event.target.value)} aria-invalid={Boolean(errors.payment)}><option value="">Selecione</option><option>Pix</option><option>Cartão</option><option>Dinheiro</option><option>A combinar</option></select>{errors.payment && <small>{errors.payment}</small>}</label><label>Observações <span>(opcional)</span><textarea rows="3" value={customer.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Alguma informação adicional sobre o pedido?"/></label></div><div className="checkout-review-total"><span>Produtos</span><strong>{money(summary.total)}</strong><span>{selectedShipping ? `${selectedShipping.company} · ${selectedShipping.serviceName}` : 'Retirada'}</span><strong>{selectedShipping ? money(selectedShipping.price) : money(0)}</strong><b>Total</b><b>{money(orderTotal)}</b></div><p className="checkout-privacy">Seus dados serão usados somente para atendimento, emissão e entrega deste pedido.</p>{submitError && <p className="checkout-error">{submitError}</p>}</section>}

    <footer className="checkout-navigation"><button className="button secondary" type="button" onClick={step === 0 ? onCancel : () => setStep((current) => current - 1)}><ArrowLeft size={17}/>{step === 0 ? 'Voltar ao carrinho' : 'Voltar'}</button>{step < 2 ? <button className="button" type="button" onClick={nextStep}>Continuar <ArrowRight size={17}/></button> : <button className="button checkout-confirm-button" type="submit" disabled={submitting}><MessageCircle size={22}/><span><strong>{submitting ? 'Confirmando pedido...' : 'Confirmar pedido'}</strong><small>{submitting ? 'Aguarde um instante' : 'Enviar pelo WhatsApp'}</small></span></button>}</footer>
  </form>;
}
