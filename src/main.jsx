import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, ShoppingBag, Menu, X, Plus, Minus, MessageCircle } from 'lucide-react';
import './styles.css';

const product = {
  id: 1,
  name: 'Vestido Alice',
  price: 99.90,
  wholesale: 79.90,
  minWholesale: 6,
  sizes: ['PP', 'P', 'M', 'G', 'GG'],
  description: 'Vestido midi em malha Menegotti 100% algodão fio 30.1 penteado, com fendas laterais e bolsos laterais.'
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
        <button className="icon mobile"><Menu size={22}/></button>
        <a className="brand" href="#"><span>CHIQUE</span><b>HELITA</b></a>
        <nav><a href="#inicio">Início</a><a href="#catalogo">Vestidos</a><a href="#promocoes">Promoções</a><a href="#sobre">Sobre nós</a></nav>
        <div className="actions"><button className="icon"><Search size={20}/></button><button className="icon cart-button" onClick={() => setCartOpen(true)}><ShoppingBag size={21}/>{qty > 0 && <span>{qty}</span>}</button></div>
      </header>

      <main>
        <section id="inicio" className="hero">
          <div><p className="eyebrow">MODA FEMININA</p><h1>Elegância que<br/><em>veste você.</em></h1><p className="hero-text">Peças pensadas para valorizar sua beleza em todos os momentos.</p><a className="button" href="#catalogo">Ver coleção</a></div>
          <div className="hero-art"><div className="dress-placeholder">CHIQUEHELITA</div></div>
        </section>

        <section className="benefits"><div><strong>Compra segura</strong><span>Seu pedido protegido</span></div><div><strong>Atendimento personalizado</strong><span>Fale conosco pelo WhatsApp</span></div><div><strong>Moda feminina</strong><span>Escolhas para você</span></div></section>

        <section id="catalogo" className="products-section">
          <div className="section-head"><div><p className="eyebrow">NOSSA COLEÇÃO</p><h2>Peças em destaque</h2></div><a href="#catalogo">Ver todos →</a></div>
          <article className="product-card">
            <div className="product-image"><div className="image-label">VESTIDO<br/>ALICE</div><span className="badge">Destaque</span></div>
            <div className="product-info"><p className="category">VESTIDOS</p><h3>{product.name}</h3><p className="description">{product.description}</p><div className="prices"><strong>{money(product.price)}</strong><span>Atacado: {money(product.wholesale)}</span></div><div className="sizes"><span>Tamanho</span>{product.sizes.map(s => <button key={s} className={size === s ? 'selected' : ''} onClick={() => setSize(s)}>{s}</button>)}</div><button className="button full" onClick={add}>Adicionar ao carrinho</button><small>Atacado: mínimo de {product.minWholesale} peças</small></div>
          </article>
        </section>

        <section id="promocoes" className="promo"><div><p className="eyebrow">OFERTAS ESPECIAIS</p><h2>Seu próximo look<br/><em>começa aqui.</em></h2><p>Confira nossas novidades e condições especiais.</p><a className="button" href="#catalogo">Ver promoções</a></div></section>
      </main>

      <footer id="sobre"><div className="footer-brand">CHIQUE<b>HELITA</b><p>Moda feminina com elegância e personalidade.</p></div><div><h4>Atendimento</h4><p>Segunda a sábado</p><p>WhatsApp da loja</p></div><div><h4>Links</h4><p>Instagram</p><p>Política de privacidade</p></div></footer>

      {cartOpen && <div className="overlay" onClick={() => setCartOpen(false)}><aside className="cart" onClick={e => e.stopPropagation()}><div className="cart-head"><h2>Seu carrinho</h2><button className="icon" onClick={() => setCartOpen(false)}><X/></button></div>{qty === 0 ? <p className="empty">Seu carrinho está vazio.</p> : <><div className="cart-item"><div className="thumb">Alice</div><div><strong>{product.name}</strong><span>Tamanho {size}</span><b>{money(product.price)}</b><div className="stepper"><button onClick={() => setQty(q => Math.max(0, q - 1))}><Minus size={15}/></button><span>{qty}</span><button onClick={() => setQty(q => q + 1)}><Plus size={15}/></button></div></div></div><div className="cart-total"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><a className="button full" href={`https://wa.me/?text=${encodeURIComponent(`Olá! Quero comprar ${qty}x ${product.name}, tamanho ${size}.`)}`} target="_blank" rel="noreferrer"><MessageCircle size={18}/> Finalizar pelo WhatsApp</a></>}</aside></div>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
