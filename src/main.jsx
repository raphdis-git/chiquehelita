import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, ShoppingBag, Menu, X, Plus, Minus, MessageCircle, Truck, ShieldCheck, Heart } from 'lucide-react';
import logo from './assets/Logo.png';
import {
  getAvailableProducts,
  getProductPrice,
  getProductWholesaleMinimum,
  getRetailPrice,
  getTotalStock,
  isProductWholesale,
  storeSettings,
} from './data/products';
import './styles.css';

function money(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function App() {
  const products = useMemo(() => getAvailableProducts(), []);
  const product = products[0];
  const initialSize = product?.sizes.find((item) => item.stock > 0)?.label ?? '';
  const [cartOpen, setCartOpen] = useState(false);
  const [size, setSize] = useState(initialSize);
  const [cart, setCart] = useState({});

  if (!product) return <main className="empty-store"><h1>CHIQUEHELITA</h1><p>Novidades chegando em breve.</p></main>;

  const selectedSize = product.sizes.find((item) => item.label === size);
  const productQuantity = Object.values(cart).reduce((total, quantity) => total + quantity, 0);
  const totalCartQuantity = productQuantity;
  const retailPrice = getRetailPrice(product);
  const wholesaleActive = isProductWholesale(product, productQuantity, totalCartQuantity);
  const currentPrice = getProductPrice(product, productQuantity, totalCartQuantity);
  const subtotal = productQuantity * currentPrice;
  const totalStock = getTotalStock(product);
  const mode = product.wholesaleRule?.mode ?? 'inherit';
  const wholesaleMinimum = getProductWholesaleMinimum(product);
  const targetMinimum = mode === 'product' ? wholesaleMinimum : storeSettings.minimumWholesaleQuantity;
  const piecesToWholesale = Math.max(0, targetMinimum - (mode === 'product' ? productQuantity : totalCartQuantity));
  const selectedQuantity = cart[size] ?? 0;
  const canAddSelected = Boolean(selectedSize?.stock) && selectedQuantity < selectedSize.stock;
  const cartLines = product.sizes.filter((item) => (cart[item.label] ?? 0) > 0);

  function changeQuantity(label, delta) {
    const sizeData = product.sizes.find((item) => item.label === label);
    if (!sizeData) return;
    setCart((current) => {
      const nextQuantity = Math.max(0, Math.min(sizeData.stock, (current[label] ?? 0) + delta));
      const next = { ...current };
      if (nextQuantity === 0) delete next[label]; else next[label] = nextQuantity;
      return next;
    });
  }

  function add() {
    if (!canAddSelected) return;
    changeQuantity(size, 1);
    setCartOpen(true);
  }

  const orderDetails = cartLines.map((item) => `${cart[item.label]}x ${product.name} tam. ${item.label}`).join(', ');
  const wholesaleRuleText = mode === 'disabled'
    ? 'Este produto não participa das regras de atacado.'
    : mode === 'product'
      ? `Regra específica: este produto entra no atacado somente a partir de ${wholesaleMinimum} unidades dele.`
      : `Regra geral: ao atingir ${storeSettings.minimumWholesaleQuantity} peças no carrinho, este produto recebe o preço de atacado.`;

  return (
    <div className="app">
      <header className="header"><button className="icon mobile" aria-label="Abrir menu"><Menu size={22}/></button><a className="brand-logo" href="#inicio" aria-label="Chique Helita"><img src={logo} alt="Chique Helita" /></a><nav><a href="#inicio">Início</a><a href="#catalogo">Vestidos</a><a href="#promocoes">Promoções</a><a href="#sobre">Sobre nós</a></nav><div className="actions"><button className="icon" aria-label="Buscar"><Search size={20}/></button><button className="icon cart-button" aria-label="Carrinho" onClick={() => setCartOpen(true)}><ShoppingBag size={21}/>{productQuantity > 0 && <span>{productQuantity}</span>}</button></div></header>
      <main>
        <section id="inicio" className="hero"><div className="hero-copy"><p className="eyebrow">MODA FEMININA</p><h1>Elegância que<br/><em>veste você.</em></h1><p className="hero-text">Vestidos femininos escolhidos para valorizar sua beleza, com conforto e personalidade.</p><a className="button" href="#catalogo">Ver coleção</a></div><div className="hero-art"><img src={product.image} alt={`${product.name} CHIQUEHELITA`}/><div className="hero-tag">{product.name.toUpperCase()}<br/><small>{money(retailPrice)}</small></div></div></section>
        <section className="benefits"><div><ShieldCheck size={22}/><strong>Compra segura</strong><span>Seu pedido protegido</span></div><div><Truck size={22}/><strong>Atendimento personalizado</strong><span>Fale conosco pelo WhatsApp</span></div><div><Heart size={22}/><strong>Moda feminina</strong><span>Escolhas feitas para você</span></div></section>
        <section id="catalogo" className="products-section"><div className="section-head"><div><p className="eyebrow">NOSSA COLEÇÃO</p><h2>Peças em destaque</h2><p>O atacado pode seguir a regra geral da loja ou uma regra específica do produto.</p></div><a href="#catalogo">Ver todos →</a></div><article className="product-card"><div className="product-image"><img src={product.image} alt={product.name}/>{product.featured && <span className="badge">Destaque</span>}<button className="heart-button" aria-label="Favoritar"><Heart size={19}/></button></div><div className="product-info"><p className="category">{product.category.toUpperCase()}</p><h3>{product.name}</h3><p className="description">{product.description}</p><div className="prices">{product.promotionalPrice && <span className="old-price">{money(product.price)}</span>}<strong>{money(retailPrice)}</strong>{mode !== 'disabled' && <span>Atacado: {money(product.wholesalePrice)}</span>}</div><div className="wholesale-rule">{wholesaleRuleText}</div><div className="stock-summary">{totalStock > 0 ? `${totalStock} unidades disponíveis` : 'Produto esgotado'}</div><div className="sizes"><span>Tamanho</span>{product.sizes.map((item) => <button key={item.label} disabled={item.stock === 0} title={`${item.stock} em estoque`} className={size === item.label ? 'selected' : ''} onClick={() => setSize(item.label)}>{item.label}<small>{item.stock}</small></button>)}</div><button className="button full" disabled={!canAddSelected} onClick={add}>{canAddSelected ? `Adicionar tamanho ${size}` : 'Estoque deste tamanho atingido'}</button><small>{product.sizes.map((item) => `${item.label} (${item.reference})`).join(' · ')}</small></div></article></section>
        <section id="promocoes" className="promo"><div><p className="eyebrow">OFERTAS ESPECIAIS</p><h2>Seu próximo look<br/><em>começa aqui.</em></h2><p>Fique de olho nas novidades e condições especiais da CHIQUEHELITA.</p><a className="button" href="#catalogo">Ver produtos</a></div></section>
      </main>
      <footer id="sobre"><div className="footer-brand"><img src={logo} alt="Chique Helita"/><p>Moda feminina com elegância e personalidade.</p></div><div><h4>Atendimento</h4><p>Segunda a sábado</p><p>WhatsApp da loja</p></div><div><h4>Links</h4><p>Instagram</p><p>Política de privacidade</p></div></footer>
      {cartOpen && <div className="overlay" onClick={() => setCartOpen(false)}><aside className="cart" onClick={(event) => event.stopPropagation()}><div className="cart-head"><h2>Seu carrinho</h2><button className="icon" onClick={() => setCartOpen(false)} aria-label="Fechar"><X/></button></div>{productQuantity === 0 ? <p className="empty">Seu carrinho está vazio.</p> : <>{cartLines.map((item) => <div className="cart-item" key={item.label}><img src={product.image} alt={product.name}/><div><strong>{product.name}</strong><span>Tamanho {item.label}</span><span>Estoque: {item.stock}</span><b>{money(currentPrice)} por peça</b><div className="stepper"><button onClick={() => changeQuantity(item.label, -1)}><Minus size={15}/></button><span>{cart[item.label]}</span><button disabled={cart[item.label] >= item.stock} onClick={() => changeQuantity(item.label, 1)}><Plus size={15}/></button></div></div></div>)}{mode !== 'disabled' && <div className={`wholesale-cart-status ${wholesaleActive ? 'active' : ''}`}>{wholesaleActive ? `Atacado ativado para ${product.name}.` : mode === 'product' ? `Adicione mais ${piecesToWholesale} ${piecesToWholesale === 1 ? 'unidade' : 'unidades'} deste produto para liberar o atacado.` : `Adicione mais ${piecesToWholesale} ${piecesToWholesale === 1 ? 'peça' : 'peças'} no carrinho para liberar o atacado.`}</div>}<div className="cart-total"><span>Total {wholesaleActive ? '(atacado)' : '(varejo)'} · {productQuantity} peças</span><strong>{money(subtotal)}</strong></div><a className="button full" href={`https://wa.me/${storeSettings.whatsapp}?text=${encodeURIComponent(`Olá! Quero fazer este pedido: ${orderDetails}. Total de peças: ${productQuantity}. Modalidade deste produto: ${wholesaleActive ? 'ATACADO' : 'VAREJO'}. Valor unitário atual: ${money(currentPrice)}. Total: ${money(subtotal)}.`)}`} target="_blank" rel="noreferrer"><MessageCircle size={18}/> Finalizar pelo WhatsApp</a></>}</aside></div>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
