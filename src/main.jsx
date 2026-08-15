import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, ShoppingBag, Menu, X, Plus, Minus, MessageCircle, Truck, ShieldCheck, Heart } from 'lucide-react';
import logo from './assets/Logo.png';
import AdminApp from './admin/AdminApp';
import { supabase } from './lib/supabase';
import { getCartLines, getCartSummary, makeCartKey } from './data/cart';
import './styles.css';

const BASE = import.meta.env.BASE_URL;

function money(value) {
  return Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function normalizeProduct(product) {
  const variants = (product.product_variants ?? [])
    .filter((variant) => variant.active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((variant) => ({
      id: variant.id,
      color: variant.color,
      printPattern: variant.print_pattern,
      image: variant.image_url,
      sizes: [...(variant.product_variant_stock ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((size) => ({ id: size.id, label: size.size, stock: size.stock })),
    }));

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    category: product.category,
    description: product.description,
    price: Number(product.price),
    promotionalPrice: product.promotional_price === null ? null : Number(product.promotional_price),
    wholesalePrice: product.wholesale_price === null ? null : Number(product.wholesale_price),
    wholesaleRuleMode: product.wholesale_rule_mode,
    wholesaleMinimumQuantity: product.wholesale_minimum_quantity,
    image: product.image_url || (product.slug === 'vestido-alice' ? `${BASE}assets/vestido-alice.svg` : null),
    sizeGuideImage: product.size_guide_image_url,
    featured: product.featured,
    variants,
  };
}

function totalStock(product) {
  return product.variants.reduce(
    (total, variant) => total + variant.sizes.reduce((sum, size) => sum + size.stock, 0),
    0,
  );
}

function retailPrice(product) {
  return product.promotionalPrice ?? product.price;
}

function firstSelection(product) {
  const variant = product.variants.find((item) => item.sizes.some((size) => size.stock > 0)) ?? product.variants[0];
  if (!variant) return { color: '', printPattern: '', variantId: '', size: '' };
  const size = variant.sizes.find((item) => item.stock > 0)?.label ?? variant.sizes[0]?.label ?? '';
  return { color: variant.color, printPattern: variant.printPattern, variantId: variant.id, size };
}

function App() {
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({ minimumWholesaleQuantity: 6, whatsapp: '556285166201' });
  const [storeLoading, setStoreLoading] = useState(true);
  const [storeError, setStoreError] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState({});
  const [selections, setSelections] = useState({});

  useEffect(() => {
    loadStore();
  }, []);

  async function loadStore() {
    setStoreLoading(true);
    const [productsResult, settingsResult] = await Promise.all([
      supabase
        .from('products')
        .select(`
          id, slug, name, category, description, price, promotional_price,
          wholesale_price, wholesale_rule_mode, wholesale_minimum_quantity,
          image_url, size_guide_image_url, featured,
          product_variants (
            id, color, print_pattern, image_url, active, sort_order,
            product_variant_stock (id, size, stock, sort_order)
          )
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('store_settings')
        .select('minimum_wholesale_quantity, whatsapp')
        .limit(1)
        .maybeSingle(),
    ]);

    if (productsResult.error || settingsResult.error) {
      setStoreError('Não foi possível carregar o catálogo agora.');
      setStoreLoading(false);
      return;
    }

    const normalized = (productsResult.data ?? []).map(normalizeProduct);
    setProducts(normalized);
    setSettings({
      minimumWholesaleQuantity: settingsResult.data?.minimum_wholesale_quantity ?? 6,
      whatsapp: settingsResult.data?.whatsapp ?? '556285166201',
    });
    setSelections(Object.fromEntries(normalized.map((product) => [product.id, firstSelection(product)])));
    setStoreLoading(false);
  }

  const featuredProduct = products.find((item) => item.featured) ?? products[0];
  const cartLines = useMemo(() => getCartLines(products, cart), [products, cart]);
  const cartSummary = useMemo(
    () => getCartSummary(products, cart, settings.minimumWholesaleQuantity),
    [products, cart, settings.minimumWholesaleQuantity],
  );
  const summaryByProduct = Object.fromEntries(cartSummary.items.map((item) => [item.productId, item]));

  function selectColor(product, color) {
    const variant = product.variants.find((item) => item.color === color && item.sizes.some((size) => size.stock > 0))
      ?? product.variants.find((item) => item.color === color);
    if (!variant) return;
    const size = variant.sizes.find((item) => item.stock > 0)?.label ?? variant.sizes[0]?.label ?? '';
    setSelections((current) => ({ ...current, [product.id]: { color, printPattern: variant.printPattern, variantId: variant.id, size } }));
  }

  function selectPrint(product, printPattern) {
    const current = selections[product.id] ?? firstSelection(product);
    const variant = product.variants.find((item) => item.color === current.color && item.printPattern === printPattern);
    if (!variant) return;
    const size = variant.sizes.find((item) => item.stock > 0)?.label ?? variant.sizes[0]?.label ?? '';
    setSelections((state) => ({ ...state, [product.id]: { ...current, printPattern, variantId: variant.id, size } }));
  }

  function changeQuantity(product, variant, size, delta) {
    const key = makeCartKey(product.id, variant.id, size.label);
    setCart((current) => {
      const nextQuantity = Math.max(0, Math.min(size.stock, (current[key] ?? 0) + delta));
      const next = { ...current };
      if (nextQuantity === 0) delete next[key]; else next[key] = nextQuantity;
      return next;
    });
  }

  function addSelected(product) {
    const selected = selections[product.id] ?? firstSelection(product);
    const variant = product.variants.find((item) => item.id === selected.variantId);
    const size = variant?.sizes.find((item) => item.label === selected.size);
    if (!variant || !size || size.stock === 0) return;
    const key = makeCartKey(product.id, variant.id, size.label);
    if ((cart[key] ?? 0) >= size.stock) return;
    changeQuantity(product, variant, size, 1);
    setCartOpen(true);
  }

  function ruleText(product) {
    if (product.wholesaleRuleMode === 'disabled') return 'Este produto não participa das regras de atacado.';
    if (product.wholesaleRuleMode === 'product') return `Regra específica: atacado a partir de ${product.wholesaleMinimumQuantity} unidades deste produto.`;
    return `Regra geral: atacado quando o carrinho atingir ${settings.minimumWholesaleQuantity} peças.`;
  }

  const whatsappLines = cartLines.map((line) => {
    const summary = summaryByProduct[line.product.id];
    return `${line.quantity}x ${line.product.name} · cor ${line.variant.color} · estampa ${line.variant.printPattern} · tam. ${line.size.label} (${summary?.wholesale ? 'atacado' : 'varejo'} a ${money(summary?.unitPrice ?? 0)})`;
  }).join(', ');

  if (storeLoading) return <main className="empty-store"><h1>CHIQUEHELITA</h1><p>Carregando coleção...</p></main>;
  if (storeError) return <main className="empty-store"><h1>CHIQUEHELITA</h1><p>{storeError}</p></main>;
  if (!featuredProduct) return <main className="empty-store"><h1>CHIQUEHELITA</h1><p>Novidades chegando em breve.</p></main>;

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
          <div className="hero-art">{featuredProduct.image ? <img src={featuredProduct.image} alt={`${featuredProduct.name} CHIQUEHELITA`}/> : <div className="product-placeholder">CHIQUEHELITA</div>}<div className="hero-tag">{featuredProduct.name.toUpperCase()}<br/><small>{money(retailPrice(featuredProduct))}</small></div></div>
        </section>

        <section className="benefits"><div><ShieldCheck size={22}/><strong>Compra segura</strong><span>Seu pedido protegido</span></div><div><Truck size={22}/><strong>Atendimento personalizado</strong><span>Fale conosco pelo WhatsApp</span></div><div><Heart size={22}/><strong>Moda feminina</strong><span>Escolhas feitas para você</span></div></section>

        <section id="catalogo" className="products-section">
          <div className="section-head"><div><p className="eyebrow">NOSSA COLEÇÃO</p><h2>Peças em destaque</h2><p>Escolha cor, estampa e tamanho. Só combinações disponíveis podem ser adicionadas ao carrinho.</p></div><a href="#catalogo">Ver todos →</a></div>
          <div className="products-list">
            {products.map((product) => {
              const selected = selections[product.id] ?? firstSelection(product);
              const variant = product.variants.find((item) => item.id === selected.variantId);
              const selectedSize = variant?.sizes.find((item) => item.label === selected.size);
              const key = variant && selectedSize ? makeCartKey(product.id, variant.id, selectedSize.label) : '';
              const selectedQuantity = key ? (cart[key] ?? 0) : 0;
              const canAdd = Boolean(selectedSize?.stock) && selectedQuantity < selectedSize.stock;
              const summary = summaryByProduct[product.id];
              const colors = [...new Set(product.variants.map((item) => item.color))];
              const prints = [...new Set(product.variants.filter((item) => item.color === selected.color).map((item) => item.printPattern))];
              const image = variant?.image || product.image;
              return (
                <article className="product-card" key={product.id}>
                  <div className="product-image">{image ? <img src={image} alt={product.name}/> : <div className="product-placeholder">Sem imagem</div>}{product.featured && <span className="badge">Destaque</span>}<button className="heart-button" aria-label="Favoritar"><Heart size={19}/></button></div>
                  <div className="product-info">
                    <p className="category">{product.category.toUpperCase()}</p><h3>{product.name}</h3><p className="description">{product.description}</p>
                    <div className="prices">{product.promotionalPrice && <span className="old-price">{money(product.price)}</span>}<strong>{money(retailPrice(product))}</strong>{product.wholesaleRuleMode !== 'disabled' && <span>Atacado: {money(product.wholesalePrice)}</span>}</div>
                    <div className="wholesale-rule">{ruleText(product)}{summary?.quantity > 0 && <><br/><strong>{summary.wholesale ? 'Preço de atacado ativo neste produto.' : 'Preço de varejo ativo neste produto.'}</strong></>}</div>
                    <div className="stock-summary">{totalStock(product) > 0 ? `${totalStock(product)} unidades disponíveis no total` : 'Produto esgotado'}</div>

                    <div className="variant-selector"><span>Cor</span><div>{colors.map((color) => <button key={color} className={selected.color === color ? 'selected' : ''} onClick={() => selectColor(product, color)}>{color}</button>)}</div></div>
                    <div className="variant-selector"><span>Estampa</span><div>{prints.map((print) => <button key={print} className={selected.printPattern === print ? 'selected' : ''} onClick={() => selectPrint(product, print)}>{print}</button>)}</div></div>
                    <div className="sizes"><span>Tamanho</span>{(variant?.sizes ?? []).map((item) => <button key={item.label} disabled={item.stock === 0} title={`${item.stock} em estoque`} className={selected.size === item.label ? 'selected' : ''} onClick={() => setSelections((current) => ({ ...current, [product.id]: { ...selected, size: item.label } }))}>{item.label}<small>{item.stock}</small></button>)}</div>
                    <button className="button full" disabled={!canAdd} onClick={() => addSelected(product)}>{canAdd ? `Adicionar ${selected.color} · ${selected.printPattern} · ${selected.size}` : 'Combinação indisponível'}</button>
                    {product.sizeGuideImage && <a className="size-guide-link" href={product.sizeGuideImage} target="_blank" rel="noreferrer">Ver guia de medidas</a>}
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
            const image = line.variant.image || line.product.image;
            return <div className="cart-item" key={makeCartKey(line.product.id, line.variant.id, line.size.label)}>{image ? <img src={image} alt={line.product.name}/> : <div className="cart-image-placeholder"/>}<div><strong>{line.product.name}</strong><span>Cor: {line.variant.color}</span><span>Estampa: {line.variant.printPattern}</span><span>Tamanho: {line.size.label}</span><span>Estoque desta combinação: {line.size.stock}</span><b>{money(summary?.unitPrice ?? 0)} por peça · {summary?.wholesale ? 'atacado' : 'varejo'}</b><div className="stepper"><button onClick={() => changeQuantity(line.product, line.variant, line.size, -1)}><Minus size={15}/></button><span>{line.quantity}</span><button disabled={line.quantity >= line.size.stock} onClick={() => changeQuantity(line.product, line.variant, line.size, 1)}><Plus size={15}/></button></div></div></div>;
          })}
          <div className={`wholesale-cart-status ${cartSummary.generalWholesaleActive ? 'active' : ''}`}>{cartSummary.generalWholesaleActive ? `Regra geral de atacado atingida com ${cartSummary.totalQuantity} peças.` : `Faltam ${Math.max(0, settings.minimumWholesaleQuantity - cartSummary.totalQuantity)} peças para atingir a regra geral de atacado.`}</div>
          <div className="cart-total"><span>Total do pedido · {cartSummary.totalQuantity} peças</span><strong>{money(cartSummary.total)}</strong></div>
          <a className="button full" href={`https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(`Olá! Quero fazer este pedido: ${whatsappLines}. Total de peças: ${cartSummary.totalQuantity}. Total do pedido: ${money(cartSummary.total)}.`)}`} target="_blank" rel="noreferrer"><MessageCircle size={18}/> Finalizar pelo WhatsApp</a>
        </>}
      </aside></div>}
    </div>
  );
}

const isAdminRoute = /\/admin\/?$/.test(window.location.pathname);

createRoot(document.getElementById('root')).render(
  isAdminRoute ? <AdminApp /> : <App />,
);
