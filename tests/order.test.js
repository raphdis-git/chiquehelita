
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWhatsAppMessage, isValidTaxId, validateCustomer } from '../src/data/order.js';

const customer = { name: 'Maria Silva', email: 'maria@example.com', taxId: '52998224725', phone: '62999998888', address: 'Rua das Flores', addressNumber: 'Quadra 2, lote 10', district: 'Centro', city: 'Goiânia', state: 'go', postalCode: '74000000', fulfillment: 'delivery', payment: 'Pix', notes: '' };

test('valida CPF e CNPJ pelos dígitos verificadores', () => {
  assert.equal(isValidTaxId('52998224725'), true);
  assert.equal(isValidTaxId('11222333000181'), true);
  assert.equal(isValidTaxId('11111111111'), false);
});

test('valida os dados obrigatórios do cliente', () => {
  assert.deepEqual(validateCustomer(customer), {});
  assert.deepEqual(Object.keys(validateCustomer({})).sort(), ['address', 'addressNumber', 'city', 'district', 'email', 'fulfillment', 'name', 'payment', 'phone', 'postalCode', 'state', 'taxId']);
});

test('gera mensagem organizada com cliente, itens e total', () => {
  const lines = [{ quantity: 2, product: { id: '1', name: 'Vestido Alice' }, variant: { color: 'Rosa', printPattern: 'Liso' }, size: { label: 'M' } }];
  const summary = { totalQuantity: 2, total: 180, items: [{ productId: '1', wholesale: false, unitPrice: 90 }] };
  const message = buildWhatsAppMessage({ customer, lines, summary, money: (value) => `R$ ${value}` });
  assert.match(message, /Maria Silva/);
  assert.match(message, /52998224725/);
  assert.match(message, /Rua das Flores/);
  assert.match(message, /74000000/);
  assert.match(message, /Goiânia - GO/);
  assert.match(message, /2x Vestido Alice/);
  assert.match(message, /Total dos produtos: R\$ 180/);
  assert.match(message, /Frete: a combinar/);
});

