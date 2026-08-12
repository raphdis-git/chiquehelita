const BASE = import.meta.env.BASE_URL;

export const storeSettings = {
  minimumWholesaleQuantity: 6,
  whatsapp: '556285166201',
};

export const products = [
  {
    id: 'vestido-alice',
    name: 'Vestido Alice',
    category: 'Vestidos',
    price: 99.9,
    promotionalPrice: null,
    wholesalePrice: 79.9,
    wholesaleRule: {
      mode: 'inherit',
      minimumQuantity: null,
    },
    featured: true,
    active: true,
    description:
      'Confeccionado em malha Menegotti 100% algodão fio 30.1 penteado, comprimento midi, fendas laterais e bolsos laterais.',
    image: `${BASE}assets/vestido-alice.svg`,
    sizes: [
      { label: 'PP', reference: '36', stock: 2 },
      { label: 'P', reference: '38', stock: 3 },
      { label: 'M', reference: '40/42', stock: 4 },
      { label: 'G', reference: '44/46', stock: 3 },
      { label: 'GG', reference: '48/50', stock: 2 },
    ],
  },
];

export function getAvailableProducts() {
  return products.filter((product) => product.active);
}

export function getRetailPrice(product) {
  return product.promotionalPrice ?? product.price;
}

export function isWholesaleCart(totalQuantity = 0) {
  return totalQuantity >= storeSettings.minimumWholesaleQuantity;
}

export function getProductWholesaleMinimum(product) {
  return product.wholesaleRule?.mode === 'product'
    ? (product.wholesaleRule.minimumQuantity ?? storeSettings.minimumWholesaleQuantity)
    : storeSettings.minimumWholesaleQuantity;
}

export function isProductWholesale(product, productQuantity = 0, totalCartQuantity = 0) {
  const mode = product.wholesaleRule?.mode ?? 'inherit';

  if (mode === 'disabled') return false;
  if (mode === 'product') return productQuantity >= getProductWholesaleMinimum(product);
  return isWholesaleCart(totalCartQuantity);
}

export function getProductPrice(product, productQuantity = 0, totalCartQuantity = 0) {
  return isProductWholesale(product, productQuantity, totalCartQuantity)
    ? product.wholesalePrice
    : getRetailPrice(product);
}

export function getTotalStock(product) {
  return product.sizes.reduce((total, size) => total + size.stock, 0);
}
