import React, { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CircleDollarSign,
  LockKeyhole,
  LogOut,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  X,
} from 'lucide-react';
import logo from '../assets/Logo.png';
import { supabase } from '../lib/supabase';
import './admin.css';

const DEFAULT_SIZES = [
  { label: 'PP', reference: '36', stock: 0 },
  { label: 'P', reference: '38', stock: 0 },
  { label: 'M', reference: '40/42', stock: 0 },
  { label: 'G', reference: '44/46', stock: 0 },
  { label: 'GG', reference: '48/50', stock: 0 },
];

function money(value) {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function wholesaleLabel(product, generalMinimum) {
  if (product.wholesale_rule_mode === 'disabled') return 'Sem atacado';
  if (product.wholesale_rule_mode === 'product') {
    return `Específica · ${product.wholesale_minimum_quantity} un.`;
  }
  return `Regra geral · ${generalMinimum} peças`;
}

function emptyProductForm() {
  return {
    name: '',
    category: 'Vestidos',
    description: '',
    price: '',
    promotionalPrice: '',
    wholesalePrice: '',
    wholesaleRuleMode: 'inherit',
    wholesaleMinimumQuantity: '',
    imageUrl: '',
    featured: false,
    active: true,
    sizes: DEFAULT_SIZES.map((size) => ({ ...size })),
  };
}

export default function AdminApp() {
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [productSaving, setProductSaving] = useState(false);
  const [productFormMessage, setProductFormMessage] = useState('');
  const [productForm, setProductForm] = useState(emptyProductForm);

  useEffect(() => {
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkSession();
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadDashboard() {
    setDashboardLoading(true);

    const [productsResult, settingsResult] = await Promise.all([
      supabase
        .from('products')
        .select(`
          id,
          slug,
          name,
          category,
          price,
          promotional_price,
          wholesale_price,
          wholesale_rule_mode,
          wholesale_minimum_quantity,
          image_url,
          featured,
          active,
          product_sizes (
            id,
            label,
            reference,
            stock,
            sort_order
          )
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('store_settings')
        .select('store_name, minimum_wholesale_quantity, primary_color, session_timeout_minutes')
        .limit(1)
        .maybeSingle(),
    ]);

    if (productsResult.error || settingsResult.error) {
      setMessage('Não foi possível carregar os dados do painel.');
      setDashboardLoading(false);
      return;
    }

    const normalized = (productsResult.data ?? []).map((product) => ({
      ...product,
      product_sizes: [...(product.product_sizes ?? [])].sort(
        (a, b) => a.sort_order - b.sort_order,
      ),
    }));

    setProducts(normalized);
    setSettings(settingsResult.data ?? null);
    setDashboardLoading(false);
  }

  async function checkSession() {
    setLoading(true);

    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    if (!currentSession) {
      setSession(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const { data: adminRecord, error } = await supabase
      .from('admin_users')
      .select('user_id, full_name, active')
      .eq('user_id', currentSession.user.id)
      .eq('active', true)
      .maybeSingle();

    if (error || !adminRecord) {
      await supabase.auth.signOut();
      setSession(null);
      setIsAdmin(false);
      setMessage('Este usuário não possui acesso administrativo.');
      setLoading(false);
      return;
    }

    setSession(currentSession);
    setIsAdmin(true);
    setLoading(false);
    await loadDashboard();
  }

  async function handleLogin(event) {
    event.preventDefault();
    setMessage('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage('E-mail ou senha inválidos.');
      setLoading(false);
      return;
    }

    await checkSession();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
    setProducts([]);
    setSettings(null);
  }

  function openNewProduct() {
    setProductForm(emptyProductForm());
    setProductFormMessage('');
    setProductFormOpen(true);
  }

  function updateProductField(field, value) {
    setProductForm((current) => ({ ...current, [field]: value }));
  }

  function updateSize(index, field, value) {
    setProductForm((current) => ({
      ...current,
      sizes: current.sizes.map((size, sizeIndex) =>
        sizeIndex === index ? { ...size, [field]: value } : size,
      ),
    }));
  }

  async function handleCreateProduct(event) {
    event.preventDefault();
    setProductFormMessage('');

    const name = productForm.name.trim();
    const slug = slugify(name);
    const price = Number(productForm.price);
    const promotionalPrice = productForm.promotionalPrice === '' ? null : Number(productForm.promotionalPrice);
    const wholesalePrice = productForm.wholesalePrice === '' ? null : Number(productForm.wholesalePrice);
    const wholesaleMinimum = productForm.wholesaleRuleMode === 'product'
      ? Number(productForm.wholesaleMinimumQuantity)
      : null;

    if (!name || !slug || Number.isNaN(price) || price < 0) {
      setProductFormMessage('Preencha o nome e o preço de varejo corretamente.');
      return;
    }

    if (productForm.wholesaleRuleMode !== 'disabled' && (wholesalePrice === null || Number.isNaN(wholesalePrice))) {
      setProductFormMessage('Informe o preço de atacado ou escolha “Sem atacado”.');
      return;
    }

    if (productForm.wholesaleRuleMode === 'product' && (!wholesaleMinimum || wholesaleMinimum < 1)) {
      setProductFormMessage('Informe a quantidade mínima da regra específica.');
      return;
    }

    setProductSaving(true);

    const { data: createdProduct, error: productError } = await supabase
      .from('products')
      .insert({
        slug,
        name,
        category: productForm.category.trim() || 'Vestidos',
        description: productForm.description.trim() || null,
        price,
        promotional_price: promotionalPrice,
        wholesale_price: productForm.wholesaleRuleMode === 'disabled' ? null : wholesalePrice,
        wholesale_rule_mode: productForm.wholesaleRuleMode,
        wholesale_minimum_quantity: wholesaleMinimum,
        image_url: productForm.imageUrl.trim() || null,
        featured: productForm.featured,
        active: productForm.active,
      })
      .select('id')
      .single();

    if (productError || !createdProduct) {
      setProductFormMessage(productError?.code === '23505'
        ? 'Já existe um produto com este nome/identificador.'
        : 'Não foi possível cadastrar o produto.');
      setProductSaving(false);
      return;
    }

    const sizesPayload = productForm.sizes.map((size, index) => ({
      product_id: createdProduct.id,
      label: size.label.trim(),
      reference: size.reference.trim() || null,
      stock: Math.max(0, Number(size.stock) || 0),
      sort_order: index,
    }));

    const { error: sizesError } = await supabase.from('product_sizes').insert(sizesPayload);

    if (sizesError) {
      await supabase.from('products').delete().eq('id', createdProduct.id);
      setProductFormMessage('O produto não pôde ser salvo porque ocorreu um erro nos tamanhos/estoque.');
      setProductSaving(false);
      return;
    }

    setProductSaving(false);
    setProductFormOpen(false);
    setMessage('Produto cadastrado com sucesso.');
    await loadDashboard();
  }

  const metrics = useMemo(() => {
    const totalStock = products.reduce(
      (sum, product) => sum + product.product_sizes.reduce((stock, size) => stock + size.stock, 0),
      0,
    );
    const activeProducts = products.filter((product) => product.active).length;
    const featuredProducts = products.filter((product) => product.featured && product.active).length;

    return {
      totalProducts: products.length,
      activeProducts,
      totalStock,
      featuredProducts,
    };
  }, [products]);

  if (loading) {
    return (
      <main className="admin-loading">
        <div className="admin-spinner" />
        <p>Carregando painel...</p>
      </main>
    );
  }

  if (!session || !isAdmin) {
    return (
      <main className="admin-login-page">
        <section className="admin-login-card">
          <img src={logo} alt="Chique Helita" className="admin-logo" />

          <div className="admin-login-heading">
            <LockKeyhole size={24} />
            <div>
              <h1>Painel Administrativo</h1>
              <p>Acesso exclusivo da administração</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="admin-login-form">
            <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
            <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
            {message && <p className="admin-message">{message}</p>}
            <button type="submit" className="admin-primary-button">Entrar no painel</button>
          </form>
        </section>
      </main>
    );
  }

  const generalMinimum = settings?.minimum_wholesale_quantity ?? 6;

  return (
    <main className="admin-dashboard">
      <header className="admin-dashboard-header">
        <div className="admin-brand"><img src={logo} alt="Chique Helita" /><div><span>Administração</span><strong>CHIQUEHELITA</strong></div></div>
        <div className="admin-header-actions">
          <button className="admin-ghost-button" onClick={loadDashboard} disabled={dashboardLoading}><RefreshCw size={17} className={dashboardLoading ? 'admin-spin-icon' : ''} />Atualizar</button>
          <button className="admin-logout-button" onClick={handleLogout}><LogOut size={18} />Sair</button>
        </div>
      </header>

      <div className="admin-shell">
        <section className="admin-welcome"><ShieldCheck size={32} /><div><p className="admin-eyebrow">ACESSO PROTEGIDO</p><h1>Painel Administrativo</h1><p>Produtos, estoque e regras comerciais agora já estão sendo lidos diretamente do Supabase.</p></div></section>

        <section className="admin-metrics" aria-label="Resumo da loja">
          <article><ShoppingBag size={22}/><span>Produtos cadastrados</span><strong>{metrics.totalProducts}</strong></article>
          <article><PackageCheck size={22}/><span>Produtos ativos</span><strong>{metrics.activeProducts}</strong></article>
          <article><Boxes size={22}/><span>Peças em estoque</span><strong>{metrics.totalStock}</strong></article>
          <article><CircleDollarSign size={22}/><span>Mínimo atacado geral</span><strong>{generalMinimum}</strong></article>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div><p className="admin-eyebrow">CATÁLOGO</p><h2>Produtos e estoque</h2><p>Cadastre novos produtos e acompanhe os dados salvos no banco.</p></div>
            <button className="admin-primary-button" type="button" onClick={openNewProduct}>+ Novo produto</button>
          </div>

          {message && <p className="admin-success-message">{message}</p>}

          {dashboardLoading ? (
            <div className="admin-inline-loading"><div className="admin-spinner"/><span>Atualizando dados...</span></div>
          ) : products.length === 0 ? (
            <div className="admin-empty-state">Nenhum produto cadastrado no banco.</div>
          ) : (
            <div className="admin-product-grid">
              {products.map((product) => {
                const stock = product.product_sizes.reduce((sum, size) => sum + size.stock, 0);
                const price = product.promotional_price ?? product.price;
                return (
                  <article className="admin-product-card" key={product.id}>
                    <div className="admin-product-image-wrap">{product.image_url ? <img src={product.image_url} alt={product.name}/> : <div className="admin-no-image">Sem imagem</div>}<span className={`admin-status ${product.active ? 'active' : 'inactive'}`}>{product.active ? 'Ativo' : 'Inativo'}</span></div>
                    <div className="admin-product-body">
                      <div className="admin-product-title-row"><div><small>{product.category}</small><h3>{product.name}</h3></div>{product.featured && <span className="admin-featured">Destaque</span>}</div>
                      <div className="admin-price-row"><div><span>Varejo</span><strong>{money(price)}</strong></div><div><span>Atacado</span><strong>{product.wholesale_rule_mode === 'disabled' ? '—' : money(product.wholesale_price)}</strong></div></div>
                      <div className="admin-rule-box"><span>Regra de atacado</span><strong>{wholesaleLabel(product, generalMinimum)}</strong></div>
                      <div className="admin-size-list">{product.product_sizes.map((size) => <div key={size.id}><span>{size.label}<small>{size.reference ? ` (${size.reference})` : ''}</small></span><strong>{size.stock}</strong></div>)}</div>
                      <div className="admin-product-footer"><span>Estoque total</span><strong>{stock} peças</strong></div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {productFormOpen && (
        <div className="admin-modal-backdrop" onClick={() => !productSaving && setProductFormOpen(false)}>
          <section className="admin-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-heading">
              <div><p className="admin-eyebrow">CATÁLOGO</p><h2>Novo produto</h2><p>Preencha os dados comerciais e o estoque inicial.</p></div>
              <button className="admin-modal-close" type="button" onClick={() => setProductFormOpen(false)} disabled={productSaving} aria-label="Fechar"><X size={20}/></button>
            </div>

            <form className="admin-product-form" onSubmit={handleCreateProduct}>
              <div className="admin-form-grid two">
                <label>Nome do produto<input value={productForm.name} onChange={(event) => updateProductField('name', event.target.value)} required /></label>
                <label>Categoria<input value={productForm.category} onChange={(event) => updateProductField('category', event.target.value)} required /></label>
              </div>

              <label>Descrição<textarea rows="3" value={productForm.description} onChange={(event) => updateProductField('description', event.target.value)} /></label>

              <div className="admin-form-grid three">
                <label>Preço varejo (R$)<input type="number" min="0" step="0.01" value={productForm.price} onChange={(event) => updateProductField('price', event.target.value)} required /></label>
                <label>Preço promocional (R$)<input type="number" min="0" step="0.01" value={productForm.promotionalPrice} onChange={(event) => updateProductField('promotionalPrice', event.target.value)} /></label>
                <label>Preço atacado (R$)<input type="number" min="0" step="0.01" disabled={productForm.wholesaleRuleMode === 'disabled'} value={productForm.wholesalePrice} onChange={(event) => updateProductField('wholesalePrice', event.target.value)} /></label>
              </div>

              <div className="admin-form-grid two">
                <label>Regra de atacado<select value={productForm.wholesaleRuleMode} onChange={(event) => updateProductField('wholesaleRuleMode', event.target.value)}><option value="inherit">Usar regra geral da loja</option><option value="product">Regra específica deste produto</option><option value="disabled">Sem atacado</option></select></label>
                <label>Quantidade mínima específica<input type="number" min="1" disabled={productForm.wholesaleRuleMode !== 'product'} value={productForm.wholesaleMinimumQuantity} onChange={(event) => updateProductField('wholesaleMinimumQuantity', event.target.value)} /></label>
              </div>

              <label>URL da imagem<input type="url" placeholder="https://..." value={productForm.imageUrl} onChange={(event) => updateProductField('imageUrl', event.target.value)} /><small>Nesta primeira versão usamos URL. Upload direto de foto será a próxima evolução.</small></label>

              <div className="admin-form-section">
                <div><h3>Tamanhos e estoque</h3><p>Informe a referência e a quantidade disponível de cada tamanho.</p></div>
                <div className="admin-size-editor">
                  {productForm.sizes.map((size, index) => (
                    <div key={size.label}>
                      <strong>{size.label}</strong>
                      <label>Referência<input value={size.reference} onChange={(event) => updateSize(index, 'reference', event.target.value)} /></label>
                      <label>Estoque<input type="number" min="0" value={size.stock} onChange={(event) => updateSize(index, 'stock', event.target.value)} /></label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin-form-checks">
                <label><input type="checkbox" checked={productForm.active} onChange={(event) => updateProductField('active', event.target.checked)} />Produto ativo na loja</label>
                <label><input type="checkbox" checked={productForm.featured} onChange={(event) => updateProductField('featured', event.target.checked)} />Produto em destaque</label>
              </div>

              {productFormMessage && <p className="admin-message">{productFormMessage}</p>}

              <div className="admin-form-actions">
                <button type="button" className="admin-secondary-button" onClick={() => setProductFormOpen(false)} disabled={productSaving}>Cancelar</button>
                <button type="submit" className="admin-primary-button" disabled={productSaving}>{productSaving ? 'Salvando...' : 'Cadastrar produto'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
