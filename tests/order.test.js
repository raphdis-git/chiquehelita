
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWhatsAppMessage, validateCustomer } from '../src/data/order.js';

const customer = { name: 'Maria Silva', city: 'Goiânia', state: 'go', fulfillment: 'delivery', payment: 'Pix', notes: '' };

test('valida os dados obrigatórios do cliente', () => {
  assert.deepEqual(validateCustomer(customer), {});
  assert.deepEqual(Object.keys(validateCustomer({})).sort(), ['city', 'fulfillment', 'name', 'payment', 'state']);
});

test('gera mensagem organizada com cliente, itens e total', () => {
  const lines = [{ quantity: 2, product: { id: '1', name: 'Vestido Alice' }, variant: { color: 'Rosa', printPattern: 'Liso' }, size: { label: 'M' } }];
  const summary = { totalQuantity: 2, total: 180, items: [{ productId: '1', wholesale: false, unitPrice: 90 }] };
  const message = buildWhatsAppMessage({ customer, lines, summary, money: (value) => `R$ ${value}` });
  assert.match(message, /Maria Silva/);
  assert.match(message, /Goiânia - GO/);
  assert.match(message, /2x Vestido Alice/);
  assert.match(message, /Total dos produtos: R\$ 180/);
  assert.match(message, /Frete: a combinar/);
});

