export function makeCartKey(productId, variantId, size) {
  return `${productId}::${variantId}::${size}`;
}

export function getTotalCartQuantity(cart) {
  return Object.values(cart).reduce((total, quantity) => total + quantity, 0);
}

export function getProductCartQuantity(cart, productId) {
  return Object.entries(cart).reduce((total, [key, quantity]) => {
    return key.startsWith(`${productId}::`) ? total + quantity : total;
  }, 0);
}

export function isProductWholesale(product, productQuantity, totalQuantity, generalMinimum) {
  if (product.wholesaleRuleMode === 'disabled') return false;
  if (product.wholesaleRuleMode === 'product') {
    return productQuantity >= Number(product.wholesaleMinimumQuantity ?? generalMinimum);
  }
  return totalQuantity >= generalMinimum;
}

export function getProductPrice(product, productQuantity, totalQuantity, generalMinimum) {
  const wholesale = isProductWholesale(product, productQuantity, totalQuantity, generalMinimum);
  if (wholesale) return Number(product.wholesalePrice ?? product.price ?? 0);
  return Number(product.promotionalPrice ?? product.price ?? 0);
}

export function getCartLines(products, cart) {
  return products.flatMap((product) =>
    product.variants.flatMap((variant) =>
      variant.sizes
        .map((size) => ({
          product,
          variant,
          size,
          quantity: cart[makeCartKey(product.id, variant.id, size.label)] ?? 0,
        }))
        .filter((line) => line.quantity > 0),
    ),
  );
}

export function getCartSummary(products, cart, generalMinimum = 6) {
  const totalQuantity = getTotalCartQuantity(cart);
  const items = products.map((product) => {
    const quantity = getProductCartQuantity(cart, product.id);
    const wholesale = isProductWholesale(product, quantity, totalQuantity, generalMinimum);
    const unitPrice = getProductPrice(product, quantity, totalQuantity, generalMinimum);
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
    generalWholesaleActive: totalQuantity >= generalMinimum,
    total: items.reduce((sum, item) => sum + item.subtotal, 0),
    items,
  };
}
