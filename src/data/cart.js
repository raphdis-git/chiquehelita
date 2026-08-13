import { getProductPrice, isProductWholesale, storeSettings } from './products';

export function makeCartKey(productId, sizeLabel) {
  return `${productId}::${sizeLabel}`;
}

export function getTotalCartQuantity(cart) {
  return Object.values(cart).reduce((total, quantity) => total + quantity, 0);
}

export function getProductCartQuantity(cart, productId) {
  return Object.entries(cart).reduce((total, [key, quantity]) => {
    return key.startsWith(`${productId}::`) ? total + quantity : total;
  }, 0);
}

export function getCartLines(products, cart) {
  return products.flatMap((product) =>
    product.sizes
      .map((size) => ({
        product,
        size,
        quantity: cart[makeCartKey(product.id, size.label)] ?? 0,
      }))
      .filter((line) => line.quantity > 0),
  );
}

export function getCartSummary(products, cart) {
  const totalQuantity = getTotalCartQuantity(cart);
  const items = products.map((product) => {
    const quantity = getProductCartQuantity(cart, product.id);
    const wholesale = isProductWholesale(product, quantity, totalQuantity);
    const unitPrice = getProductPrice(product, quantity, totalQuantity);
    return {
      productId: product.id,
      quantity,
      wholesale,
      unitPrice,
      subtotal: quantity * unitPrice,
    };
  });

  return {
    totalQuantity,
    generalWholesaleActive: totalQuantity >= storeSettings.minimumWholesaleQuantity,
    total: items.reduce((sum, item) => sum + item.subtotal, 0),
    items,
  };
}
