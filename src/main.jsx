import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, ShoppingBag, Menu, X, Plus, Minus, MessageCircle, Truck, ShieldCheck, Heart } from 'lucide-react';
import logo from './assets/Logo.png';
import { getAvailableProducts, getProductPrice, getRetailPrice, getTotalStock, isWholesaleQuantity } from './data/products';
import './styles.css';

function money(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function App() {
  const products = useMemo(() => getAvailableProducts(), []);
  const product = products[0];
  const initialSize = product?.sizes.find((item) => item.stock > 0)?.label ?? '';

  const [cartOpen, setCartOpen] = useState(false);
  const [qty, setQty] = useState(0);
  const [size, setSize] = useState(initialSize);

  if (!product) {
    return <main className="empty-store"><h1>CHIQUEHELITA</h1><p>Novidades chegando em breve.</p></main>;
  }

  const selectedSize = product.sizes.find((item) => item.label === size);
  const retailPrice = getRetailPrice(product);
  const wholesaleActive = isWholesaleQuantity(product, qty);
  const currentPrice = getProductPrice(product, qty);
  const totalStock = getTotalStock(product);
  const canAdd = Boolean(selectedSize?.stock) && qty < selectedSize.stock;
  const subtotal = qty * currentPrice;
  const piecesToWholesale = Math.max(0, product.minimumWholesaleQuantity - qty);

  function add() {
    if (!canAdd) return;
    setQty((current) => current + 1);
    setCartOpen(true);
  }

  function decrease() {
    setQty((current) => Math.max(0, current - 1));
  }

  function increase() {
    if (!selectedSize || qty >= selectedSize.stock) return;
    setQty((current) => current + 1);
  }

  function chooseSize(label) {
    setSize(label);
    setQty(0);
  }

  return (
    <div className="app">
      <header className="header">
        <button className="icon mobile" aria-label="Abrir menu"><Menu size={22}/></button>
        <a className="brand-logo" href="#inicio" aria-label="Chique Helita"><img src={logo} alt="Chique Helita" /></a>
        <nav><a href="#inicio">Início</a><a href="#catalogo">Vestidos</a><a href="#promocoes">Promoções</a><a href="#sobre">Sobre nós</a></nav>
        <div className="actions"><button className="icon" aria-label="Buscar"><Search size={20}/></button><button className="icon cart-button" aria-label="Carrinho" onClick={() => setCartOpen(true)}><ShoppingBag size={21}/>{qty > 0 && <span>{qty}</span>}</button></div>
      </header>

      <main>
        <section id="inicio" className="hero">
          <div className="hero-copy"><p className="eyebrow">MODA FEMININA</p><h1>Elegância que<br/><em>veste você.</em></h1><p className="hero-text">Vestidos femininos escolhidos para valorizar sua beleza, com conforto e personalidade.</p><a className="button" href="#catalogo">Ver coleção</a></div>
          <div className="hero-art"><img src={product.image} alt={`${product.name} CHIQUEHELITA`}/><div className="hero-tag">{product.name.toUpperCase()}<br/><small>{money(retailPrice)}</small></div></div>
        </section>

        <section className="benefits"><div><ShieldCheck size={22}/><strong>Compra segura</strong><span>Seu pedido protegido</span></div><div><Truck size={22}/><strong>Atendimento personalizado</strong><span>Fale conosco pelo WhatsApp</span></div><div><Heart size={22}/><strong>Moda feminina</strong><span>Escolhas feitas para você</span></div></section>

        <section id="catalogo" className="products-section">
          <div className="section-head"><div><p className="eyebrow">NOSSA COLEÇÃO</p><h2>Peças em destaque</h2><p>Produtos preparados para controle de preço, promoção, atacado e estoque.</p></div><a href="#catalogo">Ver todos →</a></div>
          <article className="product-card">
            <div className="product-image"><img src={product.image} alt={product.name}/>{product.featured && <span className="badge">Destaque</span>}<button className="heart-button" aria-label="Favoritar"><Heart size={19}/></button></div>
            <div className="product-info">
              <p className="category">{product.category.toUpperCase()}</p>
              <h3>{product.name}</h3>
              <p className="description">{product.description}</p>
              <div className="prices">
                {product.promotionalPrice && <span className="old-price">{money(product.price)}</span>}
                <strong>{money(retailPrice)}</strong>
                <span>Atacado: {money(product.wholesalePrice)} · a partir de {product.minimumWholesaleQuantity} peças</span>
              </div>
              <div className="wholesale-rule">Ao atingir {product.minimumWholesaleQuantity} peças, o valor unitário muda automaticamente para {money(product.wholesalePrice)}.</div>
              <div className="stock-summary">{totalStock > 0 ? `${totalStock} unidades disponíveis` : 'Produto esgotado'}</div>
              <div className="sizes"><span>Tamanho</span>{product.sizes.map((item) => <button key={item.label} disabled={item.stock === 0} title={`${item.stock} em estoque`} className={size === item.label ? 'selected' : ''} onClick={() => chooseSize(item.label)}>{item.label}<small>{item.stock}</small></button>)}</div>
              <button className="button full" disabled={!selectedSize?.stock} onClick={add}>{selectedSize?.stock ? 'Adicionar ao carrinho' : 'Tamanho esgotado'}</button>
              <small>{product.sizes.map((item) => `${item.label} (${item.reference})`).join(' · ')}</small>
            </div>
          </article>
        </section>

        <section id="promocoes" className="promo"><div><p className="eyebrow">OFERTAS ESPECIAIS</p><h2>Seu próximo look<br/><em>começa aqui.</em></h2><p>Fique de olho nas novidades e condições especiais da CHIQUEHELITA.</p><a className="button" href="#catalogo">Ver produtos</a></div></section>
      </main>

      <footer id="sobre"><div className="footer-brand"><img src={logo} alt="Chique Helita"/><p>Moda feminina com elegância e personalidade.</p></div><div><h4>Atendimento</h4><p>Segunda a sábado</p><p>WhatsApp da loja</p></div><div><h4>Links</h4><p>Instagram</p><p>Política de privacidade</p></div></footer>

      {cartOpen && <div className="overlay" onClick={() => setCartOpen(false)}><aside className="cart" onClick={(event) => event.stopPropagation()}><div className="cart-head"><h2>Seu carrinho</h2><button className="icon" onClick={() => setCartOpen(false)} aria-label="Fechar"><X/></button></div>{qty === 0 ? <p className="empty">Seu carrinho está vazio.</p> : <><div className="cart-item"><img src={product.image} alt={product.name}/><div><strong>{product.name}</strong><span>Tamanho {size}</span><span>Estoque deste tamanho: {selectedSize?.stock ?? 0}</span><b>{money(currentPrice)} por peça</b><div className="stepper"><button onClick={decrease}><Minus size={15}/></button><span>{qty}</span><button disabled={!canAdd} onClick={increase}><Plus size={15}/></button></div></div></div><div className={`wholesale-cart-status ${wholesaleActive ? 'active' : ''}`}>{wholesaleActive ? `Atacado ativado: ${money(product.wholesalePrice)} por peça.` : `Adicione mais ${piecesToWholesale} ${piecesToWholesale === 1 ? 'peça' : 'peças'} para liberar o preço de atacado de ${money(product.wholesalePrice)}.`}</div><div className="cart-total"><span>Subtotal {wholesaleActive ? '(atacado)' : '(varejo)'}</span><strong>{money(subtotal)}</strong></div><a className="button full" href={`https://wa.me/556285166201?text=${encodeURIComponent(`Olá! Quero comprar ${qty}x ${product.name}, tamanho ${size}. Modalidade: ${wholesaleActive ? 'ATACADO' : 'VAREJO'}. Valor unitário: ${money(currentPrice)}. Total: ${money(subtotal)}.`)}`} target="_blank" rel="noreferrer"><MessageCircle size={18}/> Finalizar pelo WhatsApp</a></>}</aside></div>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
