import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, ShoppingBag, Menu, X, Plus, Minus, MessageCircle, Truck, ShieldCheck, Heart } from 'lucide-react';
import logo from './assets/logo-original.png';
import './styles.css';

const BASE = import.meta.env.BASE_URL;
const product = {
  id: 1,
  name: 'Vestido Alice',
  price: 99.90,
  wholesale: 79.90,
  minWholesale: 6,
  sizes: ['PP', 'P', 'M', 'G', 'GG'],
  description: 'Confeccionado em malha Menegotti 100% algodão fio 30.1 penteado, comprimento midi, fendas laterais e bolsos laterais.',
  image: `${BASE}assets/vestido-alice.svg`
};

function money(value) { return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

function App() {
  const [cartOpen, setCartOpen] = useState(false);
  const [qty, setQty] = useState(0);
  const [size, setSize] = useState('M');

  function add() { setQty(q => q + 1); setCartOpen(true); }
  const subtotal = qty * product.price;

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
          <div className="hero-art"><img src={product.image} alt="Vestido Alice CHIQUEHELITA"/><div className="hero-tag">VESTIDO ALICE<br/><small>R$ 99,90</small></div></div>
        </section>

        <section className="benefits"><div><ShieldCheck size={22}/><strong>Compra segura</strong><span>Seu pedido protegido</span></div><div><Truck size={22}/><strong>Atendimento personalizado</strong><span>Fale conosco pelo WhatsApp</span></div><div><Heart size={22}/><strong>Moda feminina</strong><span>Escolhas feitas para você</span></div></section>

        <section id="catalogo" className="products-section">
          <div className="section-head"><div><p className="eyebrow">NOSSA COLEÇÃO</p><h2>Peças em destaque</h2><p>Conheça o primeiro destaque do nosso catálogo.</p></div><a href="#catalogo">Ver todos →</a></div>
          <article className="product-card">
            <div className="product-image"><img src={product.image} alt="Vestido Alice"/><span className="badge">Destaque</span><button className="heart-button" aria-label="Favoritar"><Heart size={19}/></button></div>
            <div className="product-info"><p className="category">VESTIDOS</p><h3>{product.name}</h3><p className="description">{product.description}</p><div className="prices"><strong>{money(product.price)}</strong><span>Atacado: {money(product.wholesale)} · mínimo de {product.minWholesale} peças</span></div><div className="sizes"><span>Tamanho</span>{product.sizes.map(s => <button key={s} className={size === s ? 'selected' : ''} onClick={() => setSize(s)}>{s}</button>)}</div><button className="button full" onClick={add}>Adicionar ao carrinho</button><small>PP (36) · P (38) · M (40/42) · G (44/46) · GG (48/50)</small></div>
          </article>
        </section>

        <section id="promocoes" className="promo"><div><p className="eyebrow">OFERTAS ESPECIAIS</p><h2>Seu próximo look<br/><em>começa aqui.</em></h2><p>Fique de olho nas novidades e condições especiais da CHIQUEHELITA.</p><a className="button" href="#catalogo">Ver produtos</a></div></section>
      </main>

      <footer id="sobre"><div className="footer-brand"><img src={logo} alt="Chique Helita"/><p>Moda feminina com elegância e personalidade.</p></div><div><h4>Atendimento</h4><p>Segunda a sábado</p><p>WhatsApp da loja</p></div><div><h4>Links</h4><p>Instagram</p><p>Política de privacidade</p></div></footer>

      {cartOpen && <div className="overlay" onClick={() => setCartOpen(false)}><aside className="cart" onClick={e => e.stopPropagation()}><div className="cart-head"><h2>Seu carrinho</h2><button className="icon" onClick={() => setCartOpen(false)} aria-label="Fechar"><X/></button></div>{qty === 0 ? <p className="empty">Seu carrinho está vazio.</p> : <><div className="cart-item"><img src={product.image} alt="Vestido Alice"/><div><strong>{product.name}</strong><span>Tamanho {size}</span><b>{money(product.price)}</b><div className="stepper"><button onClick={() => setQty(q => Math.max(0, q - 1))}><Minus size={15}/></button><span>{qty}</span><button onClick={() => setQty(q => q + 1)}><Plus size={15}/></button></div></div></div><div className="cart-total"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><a className="button full" href={`https://wa.me/?text=${encodeURIComponent(`Olá! Quero comprar ${qty}x ${product.name}, tamanho ${size}.`)}`} target="_blank" rel="noreferrer"><MessageCircle size={18}/> Finalizar pelo WhatsApp</a></>}</aside></div>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
