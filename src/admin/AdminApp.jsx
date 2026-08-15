import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, CircleDollarSign, ImagePlus, LockKeyhole, LogOut, PackageCheck, Pencil, Plus, RefreshCw, Save, Settings, ShieldCheck, ShoppingBag, Trash2, Upload, X } from 'lucide-react';
import logo from '../assets/Logo.png';
import { supabase } from '../lib/supabase';
import './admin.css';

const SIZE_LABELS = ['PP', 'P', 'M', 'G', 'GG'];
const OPTION_LABELS = { category: 'categoria', color: 'cor', print: 'estampa' };
const IMAGE_BUCKET = 'product-images';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function money(value) { return Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatCurrencyInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return (Number(digits) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseCurrencyInput(value) { const digits = String(value ?? '').replace(/\D/g, ''); return digits ? Number(digits) / 100 : null; }
function slugify(value) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function uniqueSorted(values) {
  const map = new Map();
  values.map((v) => String(v ?? '').trim()).filter(Boolean).forEach((v) => { const key = v.toLocaleLowerCase('pt-BR'); if (!map.has(key)) map.set(key, v); });
  return [...map.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
function wholesaleLabel(product, generalMinimum) {
  if (product.wholesale_rule_mode === 'disabled') return 'Sem atacado';
  if (product.wholesale_rule_mode === 'product') return `Específica · ${product.wholesale_minimum_quantity} un.`;
  return `Regra geral · ${generalMinimum} peças`;
}
function makeVariant() { return { id: null, color: '', printPattern: '', imageUrl: '', stock: Object.fromEntries(SIZE_LABELS.map((s) => [s, 0])) }; }
function emptyProductForm() {
  return { name: '', category: 'Vestidos', description: '', price: '', promotionalPrice: '', wholesalePrice: '', wholesaleRuleMode: 'inherit', wholesaleMinimumQuantity: '', imageUrl: '', sizeGuideImageUrl: '', featured: false, active: true, variants: [makeVariant()] };
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
  const [catalogOptions, setCatalogOptions] = useState([]);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [productSaving, setProductSaving] = useState(false);
  const [productFormMessage, setProductFormMessage] = useState('');
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [optionModal, setOptionModal] = useState(null);
  const [newOptionName, setNewOptionName] = useState('');
  const [optionSaving, setOptionSaving] = useState(false);
  const [optionMessage, setOptionMessage] = useState('');
  const [wholesaleMinimumDraft, setWholesaleMinimumDraft] = useState('6');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [uploadingImages, setUploadingImages] = useState({});

  useEffect(() => {
    checkSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => checkSession());
    return () => subscription.unsubscribe();
  }, []);

  async function loadDashboard() {
    setDashboardLoading(true);
    const [productsResult, settingsResult, optionsResult] = await Promise.all([
      supabase.from('products').select(`id, slug, name, category, description, price, promotional_price, wholesale_price, wholesale_rule_mode, wholesale_minimum_quantity, image_url, size_guide_image_url, featured, active, product_variants (id, color, print_pattern, image_url, sort_order, active, product_variant_stock (id, size, stock, sort_order))`).order('created_at', { ascending: false }),
      supabase.from('store_settings').select('id, store_name, minimum_wholesale_quantity, primary_color, session_timeout_minutes').limit(1).maybeSingle(),
      supabase.from('catalog_options').select('id, option_type, name, active').eq('active', true).order('name'),
    ]);
    if (productsResult.error || settingsResult.error || optionsResult.error) {
      setMessage('Não foi possível carregar os dados do painel.'); setDashboardLoading(false); return;
    }
    const normalized = (productsResult.data ?? []).map((p) => ({ ...p, product_variants: [...(p.product_variants ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((v) => ({ ...v, product_variant_stock: [...(v.product_variant_stock ?? [])].sort((a, b) => a.sort_order - b.sort_order) })) }));
    setProducts(normalized);
    setSettings(settingsResult.data ?? null);
    setWholesaleMinimumDraft(String(settingsResult.data?.minimum_wholesale_quantity ?? 6));
    setCatalogOptions(optionsResult.data ?? []);
    setDashboardLoading(false);
  }

  async function checkSession() {
    setLoading(true);
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) { setSession(null); setIsAdmin(false); setLoading(false); return; }
    const { data: adminRecord, error } = await supabase.from('admin_users').select('user_id, full_name, active').eq('user_id', currentSession.user.id).eq('active', true).maybeSingle();
    if (error || !adminRecord) { await supabase.auth.signOut(); setSession(null); setIsAdmin(false); setMessage('Este usuário não possui acesso administrativo.'); setLoading(false); return; }
    setSession(currentSession); setIsAdmin(true); setLoading(false); await loadDashboard();
  }

  async function handleLogin(event) {
    event.preventDefault(); setMessage(''); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setMessage('E-mail ou senha inválidos.'); setLoading(false); return; }
    await checkSession();
  }
  async function handleLogout() { await supabase.auth.signOut(); setSession(null); setIsAdmin(false); setProducts([]); setSettings(null); setCatalogOptions([]); }

  function openNewProduct() {
    setEditingProductId(null); setProductForm(emptyProductForm()); setProductFormMessage(''); setUploadingImages({}); setProductFormOpen(true);
  }
  function openEditProduct(product) {
    const variants = (product.product_variants ?? []).map((variant) => ({
      id: variant.id,
      color: variant.color ?? '',
      printPattern: variant.print_pattern ?? '',
      imageUrl: variant.image_url ?? '',
      stock: Object.fromEntries(SIZE_LABELS.map((size) => [size, variant.product_variant_stock.find((item) => item.size === size)?.stock ?? 0])),
    }));
    setEditingProductId(product.id);
    setProductForm({
      name: product.name ?? '', category: product.category ?? 'Vestidos', description: product.description ?? '',
      price: money(product.price), promotionalPrice: product.promotional_price == null ? '' : money(product.promotional_price),
      wholesalePrice: product.wholesale_price == null ? '' : money(product.wholesale_price),
      wholesaleRuleMode: product.wholesale_rule_mode ?? 'inherit', wholesaleMinimumQuantity: product.wholesale_minimum_quantity ?? '',
      imageUrl: product.image_url ?? '', sizeGuideImageUrl: product.size_guide_image_url ?? '', featured: Boolean(product.featured), active: Boolean(product.active),
      variants: variants.length ? variants : [makeVariant()],
    });
    setProductFormMessage(''); setUploadingImages({}); setProductFormOpen(true);
  }
  function closeProductForm() { if (productSaving) return; setProductFormOpen(false); setEditingProductId(null); setProductFormMessage(''); }
  function updateProductField(field, value) { setProductForm((current) => ({ ...current, [field]: value })); }
  function updateCurrencyField(field, value) { updateProductField(field, formatCurrencyInput(value)); }
  function addVariant() { setProductForm((current) => ({ ...current, variants: [...current.variants, makeVariant()] })); }
  function removeVariant(index) { setProductForm((current) => ({ ...current, variants: current.variants.filter((_, i) => i !== index) })); }
  function updateVariant(index, field, value) { setProductForm((current) => ({ ...current, variants: current.variants.map((v, i) => i === index ? { ...v, [field]: value } : v) })); }
  function updateVariantStock(index, size, value) { setProductForm((current) => ({ ...current, variants: current.variants.map((v, i) => i === index ? { ...v, stock: { ...v.stock, [size]: value } } : v) })); }

  function openOptionModal(type, variantIndex = null) { setOptionModal({ type, variantIndex }); setNewOptionName(''); setOptionMessage(''); }
  function closeOptionModal() { if (optionSaving) return; setOptionModal(null); setNewOptionName(''); setOptionMessage(''); }
  async function handleAddOption(event) {
    event.preventDefault(); if (!optionModal) return;
    const name = newOptionName.trim();
    if (!name) { setOptionMessage(`Informe o nome da ${OPTION_LABELS[optionModal.type]}.`); return; }
    const exists = catalogOptions.some((item) => item.option_type === optionModal.type && item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'));
    if (exists) { setOptionMessage(`Esta ${OPTION_LABELS[optionModal.type]} já está cadastrada.`); return; }
    setOptionSaving(true);
    const { data, error } = await supabase.from('catalog_options').insert({ option_type: optionModal.type, name, active: true }).select('id, option_type, name, active').single();
    if (error || !data) { setOptionMessage(error?.code === '23505' ? 'Esta opção já existe.' : 'Não foi possível adicionar a opção.'); setOptionSaving(false); return; }
    setCatalogOptions((current) => [...current, data]);
    if (optionModal.type === 'category') updateProductField('category', data.name);
    if (optionModal.type === 'color') updateVariant(optionModal.variantIndex, 'color', data.name);
    if (optionModal.type === 'print') updateVariant(optionModal.variantIndex, 'printPattern', data.name);
    setOptionSaving(false); setOptionModal(null); setNewOptionName(''); setOptionMessage('');
  }

  async function handleSaveSettings(event) {
    event.preventDefault(); const minimum = Number(wholesaleMinimumDraft); setSettingsMessage('');
    if (!Number.isInteger(minimum) || minimum < 1) { setSettingsMessage('Informe uma quantidade mínima válida, com pelo menos 1 peça.'); return; }
    if (!settings?.id) { setSettingsMessage('Não foi possível identificar as configurações da loja.'); return; }
    setSettingsSaving(true);
    const { data, error } = await supabase.from('store_settings').update({ minimum_wholesale_quantity: minimum }).eq('id', settings.id).select('id, store_name, minimum_wholesale_quantity, primary_color, session_timeout_minutes').single();
    if (error || !data) { setSettingsMessage('Não foi possível salvar a nova regra geral de atacado.'); setSettingsSaving(false); return; }
    setSettings(data); setWholesaleMinimumDraft(String(data.minimum_wholesale_quantity)); setSettingsMessage('Regra geral de atacado atualizada com sucesso.'); setSettingsSaving(false);
  }

  async function uploadImage(file, target, variantIndex = null) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setProductFormMessage('Use uma imagem JPG, PNG ou WEBP.'); return; }
    if (file.size > MAX_IMAGE_SIZE) { setProductFormMessage('A imagem deve ter no máximo 5 MB.'); return; }
    const uploadKey = variantIndex === null ? target : `${target}-${variantIndex}`;
    setUploadingImages((current) => ({ ...current, [uploadKey]: true })); setProductFormMessage('');
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileBase = slugify(file.name.replace(/\.[^.]+$/, '')) || 'imagem';
    const path = `${session.user.id}/${Date.now()}-${fileBase}.${extension}`;
    const { data: uploadData, error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
    if (error || !uploadData) { setProductFormMessage('Não foi possível enviar a imagem. Tente novamente.'); setUploadingImages((c) => ({ ...c, [uploadKey]: false })); return; }
    const { data: publicData } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(uploadData.path);
    const publicUrl = publicData?.publicUrl;
    if (!publicUrl) { setProductFormMessage('A imagem foi enviada, mas não foi possível gerar o endereço público.'); setUploadingImages((c) => ({ ...c, [uploadKey]: false })); return; }
    if (target === 'main') updateProductField('imageUrl', publicUrl);
    if (target === 'guide') updateProductField('sizeGuideImageUrl', publicUrl);
    if (target === 'variant' && variantIndex !== null) updateVariant(variantIndex, 'imageUrl', publicUrl);
    setUploadingImages((c) => ({ ...c, [uploadKey]: false }));
  }

  async function handleSaveProduct(event) {
    event.preventDefault(); setProductFormMessage('');
    const name = productForm.name.trim(); const slug = slugify(name); const price = parseCurrencyInput(productForm.price);
    const promotionalPrice = parseCurrencyInput(productForm.promotionalPrice); const wholesalePrice = parseCurrencyInput(productForm.wholesalePrice);
    const wholesaleMinimum = productForm.wholesaleRuleMode === 'product' ? Number(productForm.wholesaleMinimumQuantity) : null;
    if (!name || !slug || price === null || price < 0) { setProductFormMessage('Preencha o nome e o preço de varejo corretamente.'); return; }
    if (!productForm.category) { setProductFormMessage('Selecione uma categoria.'); return; }
    if (productForm.wholesaleRuleMode !== 'disabled' && wholesalePrice === null) { setProductFormMessage('Informe o preço de atacado ou escolha “Sem atacado”.'); return; }
    if (productForm.wholesaleRuleMode === 'product' && (!wholesaleMinimum || wholesaleMinimum < 1)) { setProductFormMessage('Informe a quantidade mínima da regra específica.'); return; }
    if (!productForm.variants.length) { setProductFormMessage('Cadastre pelo menos uma combinação de cor e estampa.'); return; }
    const normalizedVariants = productForm.variants.map((v) => ({ ...v, color: v.color.trim(), printPattern: v.printPattern.trim() }));
    if (normalizedVariants.some((v) => !v.color || !v.printPattern)) { setProductFormMessage('Selecione cor e estampa em todas as combinações.'); return; }
    const keys = normalizedVariants.map((v) => `${v.color.toLowerCase()}::${v.printPattern.toLowerCase()}`);
    if (new Set(keys).size !== keys.length) { setProductFormMessage('Existem combinações repetidas de cor e estampa.'); return; }
    if (Object.values(uploadingImages).some(Boolean)) { setProductFormMessage('Aguarde o envio das imagens terminar antes de salvar.'); return; }

    setProductSaving(true);
    const payload = { slug, name, category: productForm.category, description: productForm.description.trim() || null, price, promotional_price: promotionalPrice, wholesale_price: productForm.wholesaleRuleMode === 'disabled' ? null : wholesalePrice, wholesale_rule_mode: productForm.wholesaleRuleMode, wholesale_minimum_quantity: wholesaleMinimum, image_url: productForm.imageUrl || null, size_guide_image_url: productForm.sizeGuideImageUrl || null, featured: productForm.featured, active: productForm.active };

    let productId = editingProductId;
    if (editingProductId) {
      const { error } = await supabase.from('products').update(payload).eq('id', editingProductId);
      if (error) { setProductFormMessage(error.code === '23505' ? 'Já existe outro produto com este nome/identificador.' : 'Não foi possível salvar as alterações do produto.'); setProductSaving(false); return; }
    } else {
      const { data, error } = await supabase.from('products').insert(payload).select('id').single();
      if (error || !data) { setProductFormMessage(error?.code === '23505' ? 'Já existe um produto com este nome/identificador.' : 'Não foi possível cadastrar o produto.'); setProductSaving(false); return; }
      productId = data.id;
    }

    try {
      const savedVariantIds = [];
      for (let index = 0; index < normalizedVariants.length; index += 1) {
        const variant = normalizedVariants[index];
        const variantPayload = { product_id: productId, color: variant.color, print_pattern: variant.printPattern, image_url: variant.imageUrl || null, sort_order: index, active: true };
        let variantId = variant.id;
        if (variantId) {
          const { error } = await supabase.from('product_variants').update(variantPayload).eq('id', variantId).eq('product_id', productId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from('product_variants').insert(variantPayload).select('id').single();
          if (error || !data) throw error || new Error('variant_insert');
          variantId = data.id;
        }
        savedVariantIds.push(variantId);
        const stockPayload = SIZE_LABELS.map((size, sizeIndex) => ({ variant_id: variantId, size, stock: Math.max(0, Number(variant.stock[size]) || 0), sort_order: sizeIndex }));
        const { error: stockError } = await supabase.from('product_variant_stock').upsert(stockPayload, { onConflict: 'variant_id,size' });
        if (stockError) throw stockError;
      }
      if (editingProductId) {
        const oldIds = (products.find((p) => p.id === editingProductId)?.product_variants ?? []).map((v) => v.id);
        const removedIds = oldIds.filter((id) => !savedVariantIds.includes(id));
        if (removedIds.length) {
          const { error } = await supabase.from('product_variants').delete().in('id', removedIds).eq('product_id', productId);
          if (error) throw error;
        }
      }
    } catch {
      if (!editingProductId && productId) await supabase.from('products').delete().eq('id', productId);
      setProductFormMessage(editingProductId ? 'O produto foi atualizado, mas ocorreu um erro ao salvar variantes ou estoque. Revise e tente novamente.' : 'O produto não pôde ser salvo porque ocorreu um erro nas variantes ou no estoque.');
      setProductSaving(false); return;
    }

    setProductSaving(false); setProductFormOpen(false); setEditingProductId(null);
    setMessage(editingProductId ? 'Produto atualizado com sucesso.' : 'Produto cadastrado com sucesso.');
    await loadDashboard();
  }

  async function handleToggleProductActive() {
    if (!editingProductId) return;
    const newActive = !productForm.active;
    setProductSaving(true); setProductFormMessage('');
    const { error } = await supabase.from('products').update({ active: newActive }).eq('id', editingProductId);
    if (error) { setProductFormMessage('Não foi possível alterar o status do produto.'); setProductSaving(false); return; }
    setProductSaving(false); setProductFormOpen(false); setEditingProductId(null);
    setMessage(newActive ? 'Produto ativado e disponível para publicação.' : 'Produto desativado e removido da vitrine.');
    await loadDashboard();
  }

  const optionLists = useMemo(() => {
    const fromCatalog = (type) => catalogOptions.filter((i) => i.option_type === type && i.active).map((i) => i.name);
    const variants = products.flatMap((p) => p.product_variants ?? []);
    return { categories: uniqueSorted(['Vestidos', ...fromCatalog('category'), ...products.map((p) => p.category)]), colors: uniqueSorted([...fromCatalog('color'), ...variants.map((v) => v.color)]), prints: uniqueSorted([...fromCatalog('print'), ...variants.map((v) => v.print_pattern)]) };
  }, [catalogOptions, products]);
  const metrics = useMemo(() => ({
    totalProducts: products.length,
    activeProducts: products.filter((p) => p.active).length,
    totalStock: products.reduce((sum, p) => sum + p.product_variants.reduce((vs, v) => vs + v.product_variant_stock.reduce((ss, item) => ss + item.stock, 0), 0), 0),
  }), [products]);

  if (loading) return <main className="admin-loading"><div className="admin-spinner"/><p>Carregando painel...</p></main>;
  if (!session || !isAdmin) return <main className="admin-login-page"><section className="admin-login-card"><img src={logo} alt="Chique Helita" className="admin-logo"/><div className="admin-login-heading"><LockKeyhole size={24}/><div><h1>Painel Administrativo</h1><p>Acesso exclusivo da administração</p></div></div><form onSubmit={handleLogin} className="admin-login-form"><label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required/></label><label>Senha<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required/></label>{message && <p className="admin-message">{message}</p>}<button type="submit" className="admin-primary-button">Entrar no painel</button></form></section></main>;

  const generalMinimum = settings?.minimum_wholesale_quantity ?? 6;
  const SelectWithAdd = ({ label, value, onChange, options, type, variantIndex = null, required = false }) => <label>{label}<div className="admin-select-add"><select value={value} onChange={(e) => onChange(e.target.value)} required={required}><option value="">Selecione...</option>{options.map((item) => <option key={item} value={item}>{item}</option>)}</select><button type="button" className="admin-add-option-button" onClick={() => openOptionModal(type, variantIndex)} title={`Adicionar ${OPTION_LABELS[type]}`}><Plus size={18}/></button></div></label>;
  const ImageUploadField = ({ label, value, target, variantIndex = null }) => {
    const uploadKey = variantIndex === null ? target : `${target}-${variantIndex}`; const isUploading = Boolean(uploadingImages[uploadKey]);
    return <label className="admin-image-field">{label}<div className="admin-image-upload-box">{value ? <img src={value} alt={label} className="admin-image-preview"/> : <div className="admin-image-placeholder"><ImagePlus size={28}/><span>Nenhuma imagem selecionada</span></div>}<div className="admin-image-upload-actions"><label className={`admin-upload-button ${isUploading ? 'disabled' : ''}`}><Upload size={16}/>{isUploading ? 'Enviando...' : value ? 'Trocar imagem' : 'Escolher imagem'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={isUploading} onChange={(e) => uploadImage(e.target.files?.[0], target, variantIndex)}/></label>{value && !isUploading && <button type="button" className="admin-remove-image-button" onClick={() => { if (target === 'main') updateProductField('imageUrl', ''); if (target === 'guide') updateProductField('sizeGuideImageUrl', ''); if (target === 'variant' && variantIndex !== null) updateVariant(variantIndex, 'imageUrl', ''); }}>Remover</button>}</div><small>JPG, PNG ou WEBP · máximo 5 MB</small></div></label>;
  };

  return <main className="admin-dashboard">
    <header className="admin-dashboard-header"><div className="admin-brand"><img src={logo} alt="Chique Helita"/><div><span>Administração</span><strong>CHIQUEHELITA</strong></div></div><div className="admin-header-actions"><button className="admin-ghost-button" onClick={loadDashboard} disabled={dashboardLoading}><RefreshCw size={17} className={dashboardLoading ? 'admin-spin-icon' : ''}/>Atualizar</button><button className="admin-logout-button" onClick={handleLogout}><LogOut size={18}/>Sair</button></div></header>
    <div className="admin-shell">
      <section className="admin-welcome"><ShieldCheck size={32}/><div><p className="admin-eyebrow">ACESSO PROTEGIDO</p><h1>Painel Administrativo</h1><p>Produtos, variantes, estoque e regras comerciais são gerenciados diretamente pelo painel.</p></div></section>
      <section className="admin-metrics"><article><ShoppingBag size={22}/><span>Produtos cadastrados</span><strong>{metrics.totalProducts}</strong></article><article><PackageCheck size={22}/><span>Produtos ativos</span><strong>{metrics.activeProducts}</strong></article><article><Boxes size={22}/><span>Peças em estoque</span><strong>{metrics.totalStock}</strong></article><article><CircleDollarSign size={22}/><span>Mínimo atacado geral</span><strong>{generalMinimum}</strong></article></section>
      <section className="admin-panel admin-settings-panel"><div className="admin-settings-heading"><div><p className="admin-eyebrow">CONFIGURAÇÕES</p><h2><Settings size={21}/> Regra geral de atacado</h2><p>Defina quantas peças no carrinho são necessárias para ativar o preço de atacado nos produtos que usam a regra geral.</p></div></div><form className="admin-settings-form" onSubmit={handleSaveSettings}><label>Quantidade mínima geral<input type="number" min="1" step="1" value={wholesaleMinimumDraft} onChange={(e) => setWholesaleMinimumDraft(e.target.value)} required/></label><button type="submit" className="admin-primary-button" disabled={settingsSaving}><Save size={17}/>{settingsSaving ? 'Salvando...' : 'Salvar regra geral'}</button></form>{settingsMessage && <p className={settingsMessage.includes('sucesso') ? 'admin-success-message' : 'admin-message'}>{settingsMessage}</p>}</section>
      <section className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-eyebrow">CATÁLOGO</p><h2>Produtos e estoque</h2><p>Estoque controlado por cor, estampa e tamanho.</p></div><button className="admin-primary-button" type="button" onClick={openNewProduct}><Plus size={17}/>Novo produto</button></div>{message && <p className="admin-success-message">{message}</p>}{dashboardLoading ? <div className="admin-inline-loading"><div className="admin-spinner"/><span>Atualizando dados...</span></div> : products.length === 0 ? <div className="admin-empty-state">Nenhum produto cadastrado no banco.</div> : <div className="admin-product-grid">{products.map((product) => {
        const stock = product.product_variants.reduce((sum, v) => sum + v.product_variant_stock.reduce((sub, item) => sub + item.stock, 0), 0); const price = product.promotional_price ?? product.price;
        return <article className="admin-product-card" key={product.id}><div className="admin-product-image-wrap">{product.image_url ? <img src={product.image_url} alt={product.name}/> : <div className="admin-no-image">Sem imagem</div>}<span className={`admin-status ${product.active ? 'active' : 'inactive'}`}>{product.active ? 'Ativo' : 'Inativo'}</span></div><div className="admin-product-body"><div className="admin-product-title-row"><div><small>{product.category}</small><h3>{product.name}</h3></div>{product.featured && <span className="admin-featured">Destaque</span>}</div><div className="admin-price-row"><div><span>Varejo</span><strong>{money(price)}</strong></div><div><span>Atacado</span><strong>{product.wholesale_rule_mode === 'disabled' ? '—' : money(product.wholesale_price)}</strong></div></div><div className="admin-rule-box"><span>Regra de atacado</span><strong>{wholesaleLabel(product, generalMinimum)}</strong></div><div className="admin-variant-list">{product.product_variants.map((v) => <div className="admin-variant-summary" key={v.id}><div className="admin-variant-summary-head"><strong>{v.color}</strong><span>{v.print_pattern}</span></div><div className="admin-size-list">{v.product_variant_stock.map((item) => <div key={item.id}><span>{item.size}</span><strong>{item.stock}</strong></div>)}</div></div>)}</div><div className="admin-product-footer"><span>Estoque total</span><strong>{stock} peças</strong></div><button type="button" className="admin-edit-product-button" onClick={() => openEditProduct(product)}><Pencil size={16}/>Editar produto</button></div></article>;
      })}</div>}</section>
    </div>

    {productFormOpen && <div className="admin-modal-backdrop" onClick={closeProductForm}><section className="admin-modal" onClick={(e) => e.stopPropagation()}><div className="admin-modal-head"><div><p className="admin-eyebrow">{editingProductId ? 'EDIÇÃO' : 'CADASTRO'}</p><h2>{editingProductId ? 'Editar produto' : 'Novo produto'}</h2></div><button type="button" className="admin-icon-button" onClick={closeProductForm} disabled={productSaving}><X size={20}/></button></div><form className="admin-product-form" onSubmit={handleSaveProduct}>
      <div className="admin-form-grid two"><label>Nome do produto<input value={productForm.name} onChange={(e) => updateProductField('name', e.target.value)} required/></label><SelectWithAdd label="Categoria" value={productForm.category} onChange={(value) => updateProductField('category', value)} options={optionLists.categories} type="category" required/></div>
      <label>Descrição<textarea rows="3" value={productForm.description} onChange={(e) => updateProductField('description', e.target.value)}/></label>
      <div className="admin-form-grid three"><label>Preço varejo<input type="text" inputMode="numeric" value={productForm.price} onChange={(e) => updateCurrencyField('price', e.target.value)} placeholder="R$ 0,00" required/></label><label>Preço promocional<input type="text" inputMode="numeric" value={productForm.promotionalPrice} onChange={(e) => updateCurrencyField('promotionalPrice', e.target.value)} placeholder="R$ 0,00"/></label><label>Preço atacado<input type="text" inputMode="numeric" value={productForm.wholesalePrice} onChange={(e) => updateCurrencyField('wholesalePrice', e.target.value)} placeholder="R$ 0,00" disabled={productForm.wholesaleRuleMode === 'disabled'}/></label></div>
      <div className="admin-form-grid two"><label>Regra de atacado<select value={productForm.wholesaleRuleMode} onChange={(e) => updateProductField('wholesaleRuleMode', e.target.value)}><option value="inherit">Usar regra geral</option><option value="product">Regra específica deste produto</option><option value="disabled">Sem atacado</option></select></label>{productForm.wholesaleRuleMode === 'product' && <label>Mínimo específico<input type="number" min="1" value={productForm.wholesaleMinimumQuantity} onChange={(e) => updateProductField('wholesaleMinimumQuantity', e.target.value)}/></label>}</div>
      <div className="admin-form-grid two admin-image-grid"><ImageUploadField label="Imagem principal do produto" value={productForm.imageUrl} target="main"/><ImageUploadField label="Imagem do guia de medidas" value={productForm.sizeGuideImageUrl} target="guide"/></div>
      <div className="admin-form-options"><label><input type="checkbox" checked={productForm.active} onChange={(e) => updateProductField('active', e.target.checked)}/>Produto ativo</label><label><input type="checkbox" checked={productForm.featured} onChange={(e) => updateProductField('featured', e.target.checked)}/>Produto em destaque</label></div>
      <div className="admin-variants-section"><div className="admin-variants-heading"><div><p className="admin-eyebrow">VARIAÇÕES</p><h3>Cores, estampas e tamanhos</h3><p>Edite as combinações existentes ou adicione novas.</p></div><button className="admin-secondary-button" type="button" onClick={addVariant}><Plus size={16}/>Adicionar combinação</button></div>{productForm.variants.map((variant, index) => <div className="admin-variant-editor" key={variant.id ?? `new-${index}`}><div className="admin-variant-editor-head"><strong>Combinação {index + 1}</strong>{productForm.variants.length > 1 && <button className="admin-danger-icon" type="button" onClick={() => removeVariant(index)}><Trash2 size={17}/></button>}</div><div className="admin-form-grid two"><SelectWithAdd label="Cor" value={variant.color} onChange={(value) => updateVariant(index, 'color', value)} options={optionLists.colors} type="color" variantIndex={index} required/><SelectWithAdd label="Estampa" value={variant.printPattern} onChange={(value) => updateVariant(index, 'printPattern', value)} options={optionLists.prints} type="print" variantIndex={index} required/></div><div className="admin-variant-image-row"><ImageUploadField label="Imagem desta combinação" value={variant.imageUrl} target="variant" variantIndex={index}/></div><div className="admin-stock-grid">{SIZE_LABELS.map((size) => <label key={size}><span>{size}</span><input type="number" min="0" value={variant.stock[size]} onChange={(e) => updateVariantStock(index, size, e.target.value)}/></label>)}</div></div>)}</div>
      {productFormMessage && <p className="admin-message">{productFormMessage}</p>}
      <div className="admin-form-actions admin-edit-actions">{editingProductId && <button type="button" className={productForm.active ? 'admin-deactivate-button' : 'admin-activate-button'} onClick={handleToggleProductActive} disabled={productSaving}>{productForm.active ? 'Desativar produto' : 'Ativar produto'}</button>}<span className="admin-actions-spacer"/><button type="button" className="admin-secondary-button" onClick={closeProductForm} disabled={productSaving}>Cancelar</button><button type="submit" className="admin-primary-button" disabled={productSaving || Object.values(uploadingImages).some(Boolean)}><Save size={16}/>{productSaving ? 'Salvando...' : editingProductId ? 'Salvar alterações' : 'Cadastrar produto'}</button></div>
    </form></section></div>}

    {optionModal && <div className="admin-option-modal-backdrop" onClick={closeOptionModal}><section className="admin-option-modal" onClick={(e) => e.stopPropagation()}><div className="admin-option-modal-head"><div><p className="admin-eyebrow">NOVA OPÇÃO</p><h3>Adicionar {OPTION_LABELS[optionModal.type]}</h3></div><button type="button" className="admin-icon-button" onClick={closeOptionModal} disabled={optionSaving}><X size={18}/></button></div><form onSubmit={handleAddOption}><label>Nome da {OPTION_LABELS[optionModal.type]}<input autoFocus value={newOptionName} onChange={(e) => setNewOptionName(e.target.value)} placeholder={`Ex.: ${optionModal.type === 'category' ? 'Conjuntos' : optionModal.type === 'color' ? 'Verde Oliva' : 'Floral'}`} required/></label>{optionMessage && <p className="admin-message">{optionMessage}</p>}<div className="admin-form-actions"><button type="button" className="admin-secondary-button" onClick={closeOptionModal} disabled={optionSaving}>Cancelar</button><button type="submit" className="admin-primary-button" disabled={optionSaving}>{optionSaving ? 'Adicionando...' : 'Adicionar'}</button></div></form></section></div>}
  </main>;
}
