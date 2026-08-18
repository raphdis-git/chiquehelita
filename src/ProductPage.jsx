import React from 'react';
import { ArrowLeft, Ruler, Search, ShoppingBag } from 'lucide-react';
import logo from './assets/Logo.png';
import ProductGallery from './ProductGallery';

const money = (value) => Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const totalStock = (product) => product.variants.reduce((total, variant) => total + variant.sizes.reduce((sum, size) => sum + size.stock, 0), 0);

export default function ProductPage({ product, selection, settings, cartSummary, cartQuantity, onSelectVariant, onSelectColor, onSelectPrint, onSelectSize, onAdd, onOpenCart, cartDrawer, ruleText }) {
  const variant = product.variants.find((item) => item.id === selection.variantId);
  const size = variant?.sizes.find((item) => item.label === selection.size);
  const colors = [...new Set(product.variants.map((item) => item.color))];
  const prints = [...new Set(product.variants.filter((item) => item.color === selection.color).map((item) => item.printPattern))];
  const canAdd = Boolean(size?.stock) && cartQuantity < size.stock;
  const productSummary = cartSummary.items.find((item) => item.productId === product.id);
  const homeUrl = import.meta.env.BASE_URL;

  return <div className="app product-page-app">
    <header className="header product-page-header">
      <a className="brand-logo" href={homeUrl} aria-label="Ir para a página inicial"><img src={logo} alt="Chique Helita"/></a>
      <nav><a href={homeUrl}>Início</a><a href={`${homeUrl}#novidades`}>Vestidos</a><a href={`${homeUrl}#promocoes`}>Promoções</a><a href={`${homeUrl}#sobre`}>Sobre nós</a></nav>
      <div className="actions"><a className="icon" href={`${homeUrl}#novidades`} aria-label="Buscar produtos"><Search size={20}/></a><button className="icon cart-button" onClick={onOpenCart} aria-label="Abrir carrinho"><ShoppingBag size={21}/>{cartSummary.totalQuantity > 0 && <span>{cartSummary.totalQuantity}</span>}</button></div>
    </header>
    <main className="product-page-main">
      <div className="product-navigation"><a className="back-link" href={homeUrl}><ArrowLeft size={17}/> Voltar</a><nav className="breadcrumb" aria-label="Navegação estrutural"><a href={homeUrl}>Início</a><span>/</span><a href={`${homeUrl}#novidades`}>{product.category}</a><span>/</span><strong>{product.name}</strong></nav></div>
      <article className="product-detail">
        <ProductGallery product={product} selectedVariantId={selection.variantId} onSelectVariant={onSelectVariant}/>
        <div className="product-detail-info">
          <p className="category">{product.category.toUpperCase()}</p><h1>{product.name}</h1><p className="description">{product.description}</p>
          <div className="prices product-detail-prices">{product.promotionalPrice !== null && <span className="old-price">{money(product.price)}</span>}<strong>{money(product.promotionalPrice ?? product.price)}</strong>{product.wholesaleRuleMode !== 'disabled' && product.wholesalePrice !== null && <span>Atacado: {money(product.wholesalePrice)} por peça</span>}</div>
          <div className="wholesale-rule">{ruleText(product)}{productSummary?.quantity > 0 && <><br/><strong>{productSummary.wholesale ? 'Preço de atacado ativo neste produto.' : 'Preço de varejo ativo neste produto.'}</strong></>}</div>
          <p className={`stock-summary ${totalStock(product) === 0 ? 'out-of-stock' : ''}`}>{totalStock(product) > 0 ? `${totalStock(product)} unidades disponíveis no total` : 'Produto esgotado'}</p>
          <div className="variant-selector"><span>Cor: <strong>{selection.color}</strong></span><div>{colors.map((color) => <button key={color} className={selection.color === color ? 'selected' : ''} onClick={() => onSelectColor(color)}>{color}</button>)}</div></div>
          <div className="variant-selector"><span>Estampa: <strong>{selection.printPattern}</strong></span><div>{prints.map((print) => <button key={print} className={selection.printPattern === print ? 'selected' : ''} onClick={() => onSelectPrint(print)}>{print}</button>)}</div></div>
          <div className="sizes product-detail-sizes"><span>Tamanho</span>{(variant?.sizes ?? []).map((item) => <button key={item.label} disabled={item.stock === 0} className={selection.size === item.label ? 'selected' : ''} onClick={() => onSelectSize(item.label)}>{item.label}<small>{item.stock > 0 ? `${item.stock} disp.` : 'Esgotado'}</small></button>)}</div>
          <div className="product-cta-panel"><button className="button full product-add-button" disabled={!canAdd} onClick={onAdd}>{canAdd ? `Adicionar ao carrinho · ${selection.size}` : 'Combinação indisponível'}</button><small>Cor {selection.color} · Estampa {selection.printPattern} · Tamanho {selection.size}</small></div>
          {product.sizeGuideImage && <a className="size-guide-card" href={product.sizeGuideImage} target="_blank" rel="noreferrer"><Ruler size={20}/><span><strong>Guia de medidas</strong><small>Consulte as medidas antes de escolher</small></span></a>}
        </div>
      </article>
    </main>
    <footer><div className="footer-brand"><img src={logo} alt="Chique Helita"/><p>Moda feminina com elegância e personalidade.</p></div><div><h4>Atendimento</h4><p>Segunda a sábado</p><p>WhatsApp da loja</p></div><div><h4>Compra</h4><p>Varejo e atacado</p><p>Mínimo geral: {settings.minimumWholesaleQuantity} peças</p></div></footer>
    {cartDrawer}
  </div>;
}

