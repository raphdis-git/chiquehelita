import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getCartLines,
  getCartSummary,
  getProductPrice,
  makeCartKey,
} from '../src/data/cart.js';

const product = {
  id: 'vestido-alice',
  price: 100,
  promotionalPrice: 90,
  wholesalePrice: 70,
  wholesaleRuleMode: 'inherit',
  variants: [
    {
      id: 'rosa-liso',
      sizes: [
        { label: 'P', stock: 4 },
        { label: 'M', stock: 4 },
      ],
    },
  ],
};

test('makeCartKey separa produto, variação e tamanho', () => {
  assert.equal(makeCartKey('produto', 'variacao', 'M'), 'produto::variacao::M');
});

test('preço promocional é aplicado antes do mínimo de atacado', () => {
  assert.equal(getProductPrice(product, 2, 2, 6), 90);
});

test('preço de atacado é aplicado quando o carrinho atinge o mínimo geral', () => {
  assert.equal(getProductPrice(product, 6, 6, 6), 70);
});

test('regra específica considera somente a quantidade do produto', () => {
  const specific = {
    ...product,
    wholesaleRuleMode: 'product',
    wholesaleMinimumQuantity: 3,
  };

  assert.equal(getProductPrice(specific, 2, 20, 6), 90);
  assert.equal(getProductPrice(specific, 3, 3, 6), 70);
});

test('produto sem atacado permanece no preço de varejo', () => {
  const retailOnly = { ...product, wholesaleRuleMode: 'disabled' };
  assert.equal(getProductPrice(retailOnly, 20, 20, 6), 90);
});

test('resumo e linhas preservam variação, tamanho, quantidade e total', () => {
  const cart = {
    [makeCartKey(product.id, 'rosa-liso', 'P')]: 2,
    [makeCartKey(product.id, 'rosa-liso', 'M')]: 1,
  };

  const lines = getCartLines([product], cart);
  const summary = getCartSummary([product], cart, 6);

  assert.equal(lines.length, 2);
  assert.equal(summary.totalQuantity, 3);
  assert.equal(summary.generalWholesaleActive, false);
  assert.equal(summary.total, 270);
});

