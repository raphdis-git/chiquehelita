
const clean = (value) => String(value ?? '').trim();

export function validateCustomer(customer) {
  const errors = {};
  if (clean(customer.name).length < 2) errors.name = 'Informe seu nome.';
  if (clean(customer.city).length < 2) errors.city = 'Informe sua cidade.';
  if (!/^[A-Za-z]{2}$/.test(clean(customer.state))) errors.state = 'Use a sigla do estado.';
  if (!['delivery', 'pickup'].includes(customer.fulfillment)) errors.fulfillment = 'Escolha entrega ou retirada.';
  if (!clean(customer.payment)) errors.payment = 'Escolha a forma de pagamento.';
  return errors;
}

export function buildWhatsAppMessage({ customer, lines, summary, money }) {
  const items = lines.map((line, index) => {
    const price = summary.items.find((item) => item.productId === line.product.id);
    return `${index + 1}. ${line.quantity}x ${line.product.name}\n   Cor: ${line.variant.color} | Estampa: ${line.variant.printPattern} | Tam.: ${line.size.label}\n   ${price?.wholesale ? 'Atacado' : 'Varejo'}: ${money(price?.unitPrice ?? 0)} por peça`;
  }).join('\n\n');

  const fulfillment = customer.fulfillment === 'delivery' ? 'Entrega (frete a combinar)' : 'Retirada (detalhes a combinar)';
  const notes = clean(customer.notes) || 'Nenhuma';

  return `Olá! Quero finalizar meu pedido na CHIQUEHELITA.\n\n*DADOS DO CLIENTE*\nNome: ${clean(customer.name)}\nCidade/UF: ${clean(customer.city)} - ${clean(customer.state).toUpperCase()}\nRecebimento: ${fulfillment}\nPagamento: ${clean(customer.payment)}\n\n*ITENS DO PEDIDO*\n${items}\n\n*RESUMO*\nQuantidade: ${summary.totalQuantity} peças\nTotal dos produtos: ${money(summary.total)}\nFrete: a combinar\n\nObservações: ${notes}`;
}

