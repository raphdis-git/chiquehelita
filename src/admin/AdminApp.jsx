import React, { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CircleDollarSign,
  LockKeyhole,
  LogOut,
  PackageCheck,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import logo from '../assets/Logo.png';
import { supabase } from '../lib/supabase';
import './admin.css';

const SIZE_LABELS = ['PP', 'P', 'M', 'G', 'GG'];

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

function makeVariant() {
  return {
    color: '',
    printPattern: '',
    imageUrl: '',
    stock: Object.fromEntries(SIZE_LABELS.map((size) => [size, 0])),
  };
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
    sizeGuideImageUrl: '',
    featured: false,
    active: true,
    variants: [makeVariant()],
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
          size_guide_image_url,
          featured,
          active,
          product_variants (
            id,
            color,
            print_pattern,
            image_url,
            sort_order,
            active,
            product_variant_stock (
              id,
              size,
              stock,
              sort_order
            )
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
      product_variants: [...(product.product_variants ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((variant) => ({
          ...variant,
          product_variant_stock: [...(variant.product_variant_stock ?? [])]
            .sort((a, b) => a.sort_order - b.sort_order),
        })),
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

  function addVariant() {
    setProductForm((current) => ({
      ...current,
      variants: [...current.variants, makeVariant()],
    }));
  }

  function removeVariant(index) {
    setProductForm((current) => ({
      ...current,
      variants: current.variants.filter((_, variantIndex) => variantIndex !== index),
    }));
  }

  function updateVariant(index, field, value) {
    setProductForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, [field]: value } : variant,
      ),
    }));
  }

  function updateVariantStock(index, size, value) {
    setProductForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index
          ? { ...variant, stock: { ...variant.stock, [size]: value } }
          : variant,
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

    if (productForm.variants.length === 0) {
      setProductFormMessage('Cadastre pelo menos uma combinação de cor e estampa.');
      return;
    }

    const normalizedVariants = productForm.variants.map((variant) => ({
      ...variant,
      color: variant.color.trim(),
      printPattern: variant.printPattern.trim(),
    }));

    if (normalizedVariants.some((variant) => !variant.color || !variant.printPattern)) {
      setProductFormMessage('Preencha cor e estampa em todas as combinações.');
      return;
    }

    const combinationKeys = normalizedVariants.map((variant) => `${variant.color.toLowerCase()}::${variant.printPattern.toLowerCase()}`);
    if (new Set(combinationKeys).size !== combinationKeys.length) {
      setProductFormMessage('Existem combinações repetidas de cor e estampa.');
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
        size_guide_image_url: productForm.sizeGuideImageUrl.trim() || null,
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

    try {
      const variantsPayload = normalizedVariants.map((variant, index) => ({
        product_id: createdProduct.id,
        color: variant.color,
        print_pattern: variant.printPattern,
        image_url: variant.imageUrl.trim() || null,
        sort_order: index,
        active: true,
      }));

      const { data: createdVariants, error: variantsError } = await supabase
        .from('product_variants')
        .insert(variantsPayload)
        .select('id, color, print_pattern, sort_order');

      if (variantsError || !createdVariants || createdVariants.length !== normalizedVariants.length) {
        throw new Error('variant_error');
      }

      const stockPayload = createdVariants.flatMap((createdVariant) => {
        const sourceVariant = normalizedVariants[createdVariant.sort_order];
        return SIZE_LABELS.map((size, sizeIndex) => ({
          variant_id: createdVariant.id,
          size,
          stock: Math.max(0, Number(sourceVariant.stock[size]) || 0),
          sort_order: sizeIndex,
        }));
      });

      const { error: stockError } = await supabase
        .from('product_variant_stock')
        .insert(stockPayload);

      if (stockError) throw new Error('stock_error');
    } catch {
      await supabase.from('products').delete().eq('id', createdProduct.id);
      setProductFormMessage('O produto não pôde ser salvo porque ocorreu um erro nas variantes ou no estoque.');
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
      (sum, product) => sum + product.product_variants.reduce(
        (variantSum, variant) => variantSum + variant.product_variant_stock.reduce(
          (stockSum, item) => stockSum + item.stock,
          0,
        ),
        0,
      ),
      0,
    );

    return {
      totalProducts: products.length,
      activeProducts: products.filter((product) => product.active).length,
      totalStock,
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
            <div><h1>Painel Administrativo</h1><p>Acesso exclusivo da administração</p></div>
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
        <section className="admin-welcome"><ShieldCheck size={32} /><div><p className="admin-eyebrow">ACESSO PROTEGIDO</p><h1>Painel Administrativo</h1><p>Produtos, variantes e estoque são lidos diretamente do Supabase.</p></div></section>

        <section className="admin-metrics" aria-label="Resumo da loja">
          <article><ShoppingBag size={22}/><span>Produtos cadastrados</span><strong>{metrics.totalProducts}</strong></article>
          <article><PackageCheck size={22}/><span>Produtos ativos</span><strong>{metrics.activeProducts}</strong></article>
          <article><Boxes size={22}/><span>Peças em estoque</span><strong>{metrics.totalStock}</strong></article>
          <article><CircleDollarSign size={22}/><span>Mínimo atacado geral</span><strong>{generalMinimum}</strong></article>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div><p className="admin-eyebrow">CATÁLOGO</p><h2>Produtos e estoque</h2><p>Estoque controlado por cor, estampa e tamanho.</p></div>
            <button className="admin-primary-button" type="button" onClick={openNewProduct}><Plus size={17}/>Novo produto</button>
          </div>

          {message && <p className="admin-success-message">{message}</p>}

          {dashboardLoading ? (
            <div className="admin-inline-loading"><div className="admin-spinner"/><span>Atualizando dados...</span></div>
          ) : products.length === 0 ? (
            <div className="admin-empty-state">Nenhum produto cadastrado no banco.</div>
          ) : (
            <div className="admin-product-grid">
              {products.map((product) => {
                const stock = product.product_variants.reduce(
                  (sum, variant) => sum + variant.product_variant_stock.reduce((subtotal, item) => subtotal + item.stock, 0),
                  0,
                );
                const price = product.promotional_price ?? product.price;

                return (
                  <article className="admin-product-card" key={product.id}>
                    <div className="admin-product-image-wrap">
                      {product.image_url ? <img src={product.image_url} alt={product.name}/> : <div className="admin-no-image">Sem imagem</div>}
                      <span className={`admin-status ${product.active ? 'active' : 'inactive'}`}>{product.active ? 'Ativo' : 'Inativo'}</span>
                    </div>
                    <div className="admin-product-body">
                      <div className="admin-product-title-row"><div><small>{product.category}</small><h3>{product.name}</h3></div>{product.featured && <span className="admin-featured">Destaque</span>}</div>
                      <div className="admin-price-row"><div><span>Varejo</span><strong>{money(price)}</strong></div><div><span>Atacado</span><strong>{product.wholesale_rule_mode === 'disabled' ? '—' : money(product.wholesale_price)}</strong></div></div>
                      <div className="admin-rule-box"><span>Regra de atacado</span><strong>{wholesaleLabel(product, generalMinimum)}</strong></div>

                      <div className="admin-variant-list">
                        {product.product_variants.map((variant) => (
                          <div className="admin-variant-summary" key={variant.id}>
                            <div className="admin-variant-summary-head"><strong>{variant.color}</strong><span>{variant.print_pattern}</span></div>
                            <div className="admin-size-list">
                              {variant.product_variant_stock.map((item) => <div key={item.id}><span>{item.size}</span><strong>{item.stock}</strong></div>)}
                            </div>
                          </div>
                        ))}
                      </div>

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
            <div className="admin-modal-head">
              <div><p className="admin-eyebrow">CADASTRO</p><h2>Novo produto</h2></div>
              <button type="button" className="admin-icon-button" onClick={() => setProductFormOpen(false)} disabled={productSaving}><X size={20}/></button>
            </div>

            <form className="admin-product-form" onSubmit={handleCreateProduct}>
              <div className="admin-form-grid two">
                <label>Nome do produto<input value={productForm.name} onChange={(e) => updateProductField('name', e.target.value)} required /></label>
                <label>Categoria<input value={productForm.category} onChange={(e) => updateProductField('category', e.target.value)} /></label>
              </div>

              <label>Descrição<textarea rows="3" value={productForm.description} onChange={(e) => updateProductField('description', e.target.value)} /></label>

              <div className="admin-form-grid three">
                <label>Preço varejo<input type="number" step="0.01" min="0" value={productForm.price} onChange={(e) => updateProductField('price', e.target.value)} required /></label>
                <label>Preço promocional<input type="number" step="0.01" min="0" value={productForm.promotionalPrice} onChange={(e) => updateProductField('promotionalPrice', e.target.value)} /></label>
                <label>Preço atacado<input type="number" step="0.01" min="0" value={productForm.wholesalePrice} onChange={(e) => updateProductField('wholesalePrice', e.target.value)} disabled={productForm.wholesaleRuleMode === 'disabled'} /></label>
              </div>

              <div className="admin-form-grid two">
                <label>Regra de atacado<select value={productForm.wholesaleRuleMode} onChange={(e) => updateProductField('wholesaleRuleMode', e.target.value)}><option value="inherit">Usar regra geral</option><option value="product">Regra específica deste produto</option><option value="disabled">Sem atacado</option></select></label>
                {productForm.wholesaleRuleMode === 'product' && <label>Mínimo específico<input type="number" min="1" value={productForm.wholesaleMinimumQuantity} onChange={(e) => updateProductField('wholesaleMinimumQuantity', e.target.value)} /></label>}
              </div>

              <div className="admin-form-grid two">
                <label>URL da imagem principal<input type="url" value={productForm.imageUrl} onChange={(e) => updateProductField('imageUrl', e.target.value)} placeholder="https://..." /></label>
                <label>URL da imagem do guia de medidas<input type="url" value={productForm.sizeGuideImageUrl} onChange={(e) => updateProductField('sizeGuideImageUrl', e.target.value)} placeholder="https://..." /></label>
              </div>

              <div className="admin-form-options">
                <label><input type="checkbox" checked={productForm.active} onChange={(e) => updateProductField('active', e.target.checked)} />Produto ativo</label>
                <label><input type="checkbox" checked={productForm.featured} onChange={(e) => updateProductField('featured', e.target.checked)} />Produto em destaque</label>
              </div>

              <div className="admin-variants-section">
                <div className="admin-variants-heading">
                  <div><p className="admin-eyebrow">VARIAÇÕES</p><h3>Cores, estampas e tamanhos</h3><p>Cada combinação de cor + estampa possui estoque próprio por tamanho.</p></div>
                  <button className="admin-secondary-button" type="button" onClick={addVariant}><Plus size={16}/>Adicionar combinação</button>
                </div>

                {productForm.variants.map((variant, index) => (
                  <div className="admin-variant-editor" key={index}>
                    <div className="admin-variant-editor-head">
                      <strong>Combinação {index + 1}</strong>
                      {productForm.variants.length > 1 && <button className="admin-danger-icon" type="button" onClick={() => removeVariant(index)} aria-label="Remover combinação"><Trash2 size={17}/></button>}
                    </div>

                    <div className="admin-form-grid three">
                      <label>Cor<input value={variant.color} onChange={(e) => updateVariant(index, 'color', e.target.value)} placeholder="Ex.: Rosa" required /></label>
                      <label>Estampa<input value={variant.printPattern} onChange={(e) => updateVariant(index, 'printPattern', e.target.value)} placeholder="Ex.: Floral, Lisa" required /></label>
                      <label>Imagem desta combinação<input type="url" value={variant.imageUrl} onChange={(e) => updateVariant(index, 'imageUrl', e.target.value)} placeholder="https://..." /></label>
                    </div>

                    <div className="admin-stock-grid">
                      {SIZE_LABELS.map((size) => (
                        <label key={size}><span>{size}</span><input type="number" min="0" value={variant.stock[size]} onChange={(e) => updateVariantStock(index, size, e.target.value)} /></label>
                      ))}
                    </div>
                  </div>
                ))}
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
