import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, ShoppingBag, Menu, X, Plus, Minus, MessageCircle, Truck, ShieldCheck, Heart } from 'lucide-react';
import logo from './assets/Logo.png';
import AdminApp from './admin/AdminApp';
import {
  getAvailableProducts,
  getProductWholesaleMinimum,
  getRetailPrice,
  getTotalStock,
  storeSettings,
} from './data/products';
import {
  getCartLines,
  getCartSummary,
  getProductCartQuantity,
  makeCartKey,
} from './data/cart';
import './styles.css';

function money(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function App() {
  const products = useMemo(() => getAvailableProducts(), []);
  const featuredProduct = products.find((item) => item.featured) ?? products[0];
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState({});
  const [selectedSizes, setSelectedSizes] = useState(() => Object.fromEntries(
    products.map((product) => [product.id, product.sizes.find((item) => item.stock > 0)?.label ?? '']),
  ));

  if (!featuredProduct) {
    return <main className="empty-store"><h1>CHIQUEHELITA</h1><p>Novidades chegando em breve.</p></main>;
  }

  const cartLines = getCartLines(products, cart);
  const cartSummary = getCartSummary(products, cart);
  const summaryByProduct = Object.fromEntries(cartSummary.items.map((item) => [item.productId, item]));

  function changeQuantity(product, size, delta) {
    const key = makeCartKey(product.id, size.label);
    setCart((current) => {
      const nextQuantity = Math.max(0, Math.min(size.stock, (current[key] ?? 0) + delta));
      const next = { ...current };
      if (nextQuantity === 0) delete next[key]; else next[key] = nextQuantity;
      return next;
    });
  }

  function addSelected(product) {
    const label = selectedSizes[product.id];
    const size = product.sizes.find((item) => item.label === label);
    if (!size) return;
    const key = makeCartKey(product.id, size.label);
    if ((cart[key] ?? 0) >= size.stock) return;
    changeQuantity(product, size, 1);
    setCartOpen(true);
  }

  function ruleText(product) {
    const mode = product.wholesaleRule?.mode ?? 'inherit';
    if (mode === 'disabled') return 'Este produto não participa das regras de atacado.';
    if (mode === 'product') return `Regra específica: atacado a partir de ${getProductWholesaleMinimum(product)} unidades deste produto.`;
    return `Regra geral: atacado quando o carrinho atingir ${storeSettings.minimumWholesaleQuantity} peças.`;
  }

  const whatsappLines = cartLines.map((line) => {
    const summary = summaryByProduct[line.product.id];
    return `${line.quantity}x ${line.product.name} tam. ${line.size.label} (${summary?.wholesale ? 'atacado' : 'varejo'} a ${money(summary?.unitPrice ?? 0)})`;
  }).join(', ');

  return (
    <div className="app">
      <header className="header">
        <button className="icon mobile" aria-label="Abrir menu"><Menu size={22}/></button>
        <a className="brand-logo" href="#inicio" aria-label="Chique Helita"><img src={logo} alt="Chique Helita" /></a>
        <nav><a href="#inicio">Início</a><a href="#catalogo">Vestidos</a><a href="#promocoes">Promoções</a><a href="#sobre">Sobre nós</a></nav>
        <div className="actions"><button className="icon" aria-label="Buscar"><Search size={20}/></button><button className="icon cart-button" aria-label="Carrinho" onClick={() => setCartOpen(true)}><ShoppingBag size={21}/>{cartSummary.totalQuantity > 0 && <span>{cartSummary.totalQuantity}</span>}</button></div>
      </header>

      <main>
        <section id="inicio" className="hero">
          <div className="hero-copy"><p className="eyebrow">MODA FEMININA</p><h1>Elegância que<br/><em>veste você.</em></h1><p className="hero-text">Vestidos femininos escolhidos para valorizar sua beleza, com conforto e personalidade.</p><a className="button" href="#catalogo">Ver coleção</a></div>
          <div className="hero-art"><img src={featuredProduct.image} alt={`${featuredProduct.name} CHIQUEHELITA`}/><div className="hero-tag">{featuredProduct.name.toUpperCase()}<br/><small>{money(getRetailPrice(featuredProduct))}</small></div></div>
        </section>

        <section className="benefits"><div><ShieldCheck size={22}/><strong>Compra segura</strong><span>Seu pedido protegido</span></div><div><Truck size={22}/><strong>Atendimento personalizado</strong><span>Fale conosco pelo WhatsApp</span></div><div><Heart size={22}/><strong>Moda feminina</strong><span>Escolhas feitas para você</span></div></section>

        <section id="catalogo" className="products-section">
          <div className="section-head"><div><p className="eyebrow">NOSSA COLEÇÃO</p><h2>Peças em destaque</h2><p>O carrinho já está preparado para combinar vários modelos e tamanhos no mesmo pedido.</p></div><a href="#catalogo">Ver todos →</a></div>
          <div className="products-list">
            {products.map((product) => {
              const selectedLabel = selectedSizes[product.id];
              const selectedSize = product.sizes.find((item) => item.label === selectedLabel);
              const selectedKey = selectedSize ? makeCartKey(product.id, selectedSize.label) : '';
              const selectedQuantity = selectedKey ? (cart[selectedKey] ?? 0) : 0;
              const canAdd = Boolean(selectedSize?.stock) && selectedQuantity < selectedSize.stock;
              const summary = summaryByProduct[product.id];
              const mode = product.wholesaleRule?.mode ?? 'inherit';
              return (
                <article className="product-card" key={product.id}>
                  <div className="product-image"><img src={product.image} alt={product.name}/>{product.featured && <span className="badge">Destaque</span>}<button className="heart-button" aria-label="Favoritar"><Heart size={19}/></button></div>
                  <div className="product-info">
                    <p className="category">{product.category.toUpperCase()}</p><h3>{product.name}</h3><p className="description">{product.description}</p>
                    <div className="prices">{product.promotionalPrice && <span className="old-price">{money(product.price)}</span>}<strong>{money(getRetailPrice(product))}</strong>{mode !== 'disabled' && <span>Atacado: {money(product.wholesalePrice)}</span>}</div>
                    <div className="wholesale-rule">{ruleText(product)}{summary?.quantity > 0 && <><br/><strong>{summary.wholesale ? 'Preço de atacado ativo neste produto.' : 'Preço de varejo ativo neste produto.'}</strong></>}</div>
                    <div className="stock-summary">{getTotalStock(product) > 0 ? `${getTotalStock(product)} unidades disponíveis` : 'Produto esgotado'}</div>
                    <div className="sizes"><span>Tamanho</span>{product.sizes.map((item) => <button key={item.label} disabled={item.stock === 0} title={`${item.stock} em estoque`} className={selectedLabel === item.label ? 'selected' : ''} onClick={() => setSelectedSizes((current) => ({ ...current, [product.id]: item.label }))}>{item.label}<small>{item.stock}</small></button>)}</div>
                    <button className="button full" disabled={!canAdd} onClick={() => addSelected(product)}>{canAdd ? `Adicionar tamanho ${selectedLabel}` : 'Estoque deste tamanho atingido'}</button>
                    <small>{product.sizes.map((item) => `${item.label} (${item.reference})`).join(' · ')}</small>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section id="promocoes" className="promo"><div><p className="eyebrow">OFERTAS ESPECIAIS</p><h2>Seu próximo look<br/><em>começa aqui.</em></h2><p>Fique de olho nas novidades e condições especiais da CHIQUEHELITA.</p><a className="button" href="#catalogo">Ver produtos</a></div></section>
      </main>

      <footer id="sobre"><div className="footer-brand"><img src={logo} alt="Chique Helita"/><p>Moda feminina com elegância e personalidade.</p></div><div><h4>Atendimento</h4><p>Segunda a sábado</p><p>WhatsApp da loja</p></div><div><h4>Links</h4><p>Instagram</p><p>Política de privacidade</p></div></footer>

      {cartOpen && <div className="overlay" onClick={() => setCartOpen(false)}><aside className="cart" onClick={(event) => event.stopPropagation()}>
        <div className="cart-head"><h2>Seu carrinho</h2><button className="icon" onClick={() => setCartOpen(false)} aria-label="Fechar"><X/></button></div>
        {cartSummary.totalQuantity === 0 ? <p className="empty">Seu carrinho está vazio.</p> : <>
          {cartLines.map((line) => {
            const summary = summaryByProduct[line.product.id];
            return <div className="cart-item" key={makeCartKey(line.product.id, line.size.label)}><img src={line.product.image} alt={line.product.name}/><div><strong>{line.product.name}</strong><span>Tamanho {line.size.label}</span><span>Estoque: {line.size.stock}</span><b>{money(summary?.unitPrice ?? 0)} por peça · {summary?.wholesale ? 'atacado' : 'varejo'}</b><div className="stepper"><button onClick={() => changeQuantity(line.product, line.size, -1)}><Minus size={15}/></button><span>{line.quantity}</span><button disabled={line.quantity >= line.size.stock} onClick={() => changeQuantity(line.product, line.size, 1)}><Plus size={15}/></button></div></div></div>;
          })}
          <div className={`wholesale-cart-status ${cartSummary.generalWholesaleActive ? 'active' : ''}`}>{cartSummary.generalWholesaleActive ? `Regra geral de atacado atingida com ${cartSummary.totalQuantity} peças.` : `Faltam ${Math.max(0, storeSettings.minimumWholesaleQuantity - cartSummary.totalQuantity)} peças para atingir a regra geral de atacado.`}</div>
          <div className="cart-total"><span>Total do pedido · {cartSummary.totalQuantity} peças</span><strong>{money(cartSummary.total)}</strong></div>
          <a className="button full" href={`https://wa.me/${storeSettings.whatsapp}?text=${encodeURIComponent(`Olá! Quero fazer este pedido: ${whatsappLines}. Total de peças: ${cartSummary.totalQuantity}. Total do pedido: ${money(cartSummary.total)}.`)}`} target="_blank" rel="noreferrer"><MessageCircle size={18}/> Finalizar pelo WhatsApp</a>
        </>}
      </aside></div>}
    </div>
  );
}

const isAdminRoute = /\/admin\/?$/.test(window.location.pathname);

createRoot(document.getElementById('root')).render(
  isAdminRoute ? <AdminApp /> : <App />,
);
