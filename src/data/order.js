
const clean = (value) => String(value ?? '').trim();
const digits = (value) => clean(value).replace(/\D/g, '');

function hasValidCheckDigits(value, size) {
  const document = digits(value);
  if (document.length !== size || /^(\d)\1+$/.test(document)) return false;
  const calculate = (base, weights) => {
    const sum = base.split('').reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  if (size === 11) {
    const first = calculate(document.slice(0, 9), [10,9,8,7,6,5,4,3,2]);
    const second = calculate(document.slice(0, 10), [11,10,9,8,7,6,5,4,3,2]);
    return document.endsWith(`${first}${second}`);
  }
  const first = calculate(document.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]);
  const second = calculate(document.slice(0, 13), [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return document.endsWith(`${first}${second}`);
}

export function isValidTaxId(value) {
  const document = digits(value);
  return hasValidCheckDigits(document, document.length);
}

export function validateCustomer(customer) {
  const errors = {};
  if (clean(customer.name).split(/\s+/).length < 2) errors.name = 'Informe nome e sobrenome.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(customer.email))) errors.email = 'Informe um e-mail válido.';
  if (!isValidTaxId(customer.taxId)) errors.taxId = 'Informe um CPF ou CNPJ válido.';
  if (!/^\d{10,11}$/.test(digits(customer.phone))) errors.phone = 'Informe DDD e telefone com 10 ou 11 números.';
  if (clean(customer.address).length < 3) errors.address = 'Informe a rua ou avenida.';
  if (clean(customer.addressNumber).length < 1) errors.addressNumber = 'Informe quadra, lote, número ou S/N.';
  if (clean(customer.district).length < 2) errors.district = 'Informe o bairro ou setor.';
  if (clean(customer.city).length < 2) errors.city = 'Informe sua cidade.';
  if (!/^[A-Za-z]{2}$/.test(clean(customer.state))) errors.state = 'Use a sigla do estado.';
  if (!/^\d{8}$/.test(digits(customer.postalCode))) errors.postalCode = 'Informe os 8 números do CEP.';
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

  return `Olá! Quero finalizar meu pedido na CHIQUEHELITA.\n\n*DADOS DO CLIENTE*\nNome completo: ${clean(customer.name)}\nE-mail: ${clean(customer.email)}\nCPF/CNPJ: ${digits(customer.taxId)}\nTelefone: ${digits(customer.phone)}\nEndereço: ${clean(customer.address)}\nQuadra / lote / número: ${clean(customer.addressNumber)}\nBairro/setor: ${clean(customer.district)}\nCidade/UF: ${clean(customer.city)} - ${clean(customer.state).toUpperCase()}\nCEP: ${digits(customer.postalCode)}\nRecebimento: ${fulfillment}\nPagamento: ${clean(customer.payment)}\n\n*ITENS DO PEDIDO*\n${items}\n\n*RESUMO*\nQuantidade: ${summary.totalQuantity} peças\nTotal dos produtos: ${money(summary.total)}\nFrete: a combinar\n\nObservações: ${notes}`;
}

