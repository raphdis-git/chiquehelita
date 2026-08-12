const BASE = import.meta.env.BASE_URL;

export const products = [
  {
    id: 'vestido-alice',
    name: 'Vestido Alice',
    category: 'Vestidos',
    price: 99.9,
    promotionalPrice: null,
    wholesalePrice: 79.9,
    minimumWholesaleQuantity: 6,
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

export function getProductPrice(product) {
  return product.promotionalPrice ?? product.price;
}

export function getTotalStock(product) {
  return product.sizes.reduce((total, size) => total + size.stock, 0);
}
