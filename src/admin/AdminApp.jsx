import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Boxes, ChevronDown, CircleDollarSign, Home, ImagePlus, LockKeyhole, LogOut, PackageCheck,
  Pencil, Plus, Power, RefreshCw, Save, Search, Settings, ShieldCheck, ShoppingBag, Tags,
  Trash2, Upload, Users, X,
} from 'lucide-react';
import logo from '../assets/Logo.png';
import BrandLoader from '../BrandLoader';
import { supabase } from '../lib/supabase';
import './admin.css';
import './admin-orders.css';
import './admin-orders-dashboard.css';
import './admin-clients.css';
import './admin-catalog.css';
import './admin-session.css';
import './admin-shipping.css';

const SIZE_LABELS = ['PP', 'P', 'M', 'G', 'GG'];
const OPTION_LABELS = { category: 'categoria', color: 'cor', print: 'estampa' };
const IMAGE_BUCKET = 'product-images';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ORDER_STATUSES = { new: 'Novo', contacted: 'Contatado', confirmed: 'Confirmado', preparing: 'Em preparação', shipped: 'Enviado', completed: 'Concluído', cancelled: 'Cancelado' };
const TRACKING_STATUSES = { awaiting_shipment: 'Aguardando postagem', posted: 'Postado', in_transit: 'Em trânsito', out_for_delivery: 'Saiu para entrega', delivered: 'Entregue', exception: 'Ocorrência na entrega', returned: 'Devolvido' };

function money(value) {
  return Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatCurrencyInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return (Number(digits) / 100).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}
function parseCurrencyInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? Number(digits) / 100 : null;
}
function slugify(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function uniqueSorted(values) {
  const map = new Map();
  values.map((v) => String(v ?? '').trim()).filter(Boolean).forEach((v) => {
    const key = v.toLocaleLowerCase('pt-BR');
    if (!map.has(key)) map.set(key, v);
  });
  return [...map.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
function wholesaleLabel(product, generalMinimum) {
  if (product.wholesale_rule_mode === 'disabled') return 'Sem atacado';
  if (product.wholesale_rule_mode === 'product') return `Específica · ${product.wholesale_minimum_quantity} un.`;
  return `Regra geral · ${generalMinimum} peças`;
}
function makeVariant(imageUrl = '') {
  return {
    id: null,
    color: '',
    printPattern: '',
    images: imageUrl ? [imageUrl] : [],
    primaryImageUrl: imageUrl,
    stock: Object.fromEntries(SIZE_LABELS.map((s) => [s, 0])),
  };
}
function emptyProductForm() {
  return {
    name: '', category: 'Vestidos', description: '', price: '', promotionalPrice: '', wholesalePrice: '',
    wholesaleRuleMode: 'inherit', wholesaleMinimumQuantity: '', imageUrl: '', sizeGuideImageUrl: '',
    shippingWeightGrams: '', shippingHeightCm: '', shippingWidthCm: '', shippingLengthCm: '',
    featured: false, showInPromotions: false, active: true, variants: [],
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
  const [orders, setOrders] = useState([]);
  const [orderSaving, setOrderSaving] = useState('');
  const [trackingDrafts, setTrackingDrafts] = useState({});
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [expandedOrderIds, setExpandedOrderIds] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [settings, setSettings] = useState(null);
  const [catalogOptions, setCatalogOptions] = useState([]);
  const [adminSection, setAdminSection] = useState('dashboard');
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [productTab, setProductTab] = useState('data');
  const [editingProductId, setEditingProductId] = useState(null);
  const [productSaving, setProductSaving] = useState(false);
  const [productFormMessage, setProductFormMessage] = useState('');
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [optionModal, setOptionModal] = useState(null);
  const [newOptionName, setNewOptionName] = useState('');
  const [optionSaving, setOptionSaving] = useState(false);
  const [optionMessage, setOptionMessage] = useState('');
  const [catalogSearch, setCatalogSearch] = useState({ category: '', color: '', print: '' });
  const [wholesaleMinimumDraft, setWholesaleMinimumDraft] = useState('6');
  const [sessionTimeoutDraft, setSessionTimeoutDraft] = useState('60');
  const [storeNameDraft, setStoreNameDraft] = useState('CHIQUEHELITA');
  const [whatsappDraft, setWhatsappDraft] = useState('');
  const [shippingDraft, setShippingDraft] = useState({ originPostalCode:'', weightGrams:'500', packagingTareGrams:'100', heightCm:'10', widthCm:'20', lengthCm:'30', maxItems:'5', handlingDays:'1', markup:'0', melhorEnvioEnabled:false, correiosEnabled:false });
  const [senderDraft, setSenderDraft] = useState({ name:'', email:'', phone:'', taxId:'', stateRegister:'', address:'', number:'', complement:'', district:'', city:'', state:'' });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [melhorEnvioConnection, setMelhorEnvioConnection] = useState({ loading: true, connected: false, expiresAt: null });
  const [uploadingImages, setUploadingImages] = useState({});
  const [sessionWarningSeconds, setSessionWarningSeconds] = useState(null);
  const lastAdminActivity = useRef(Date.now());
  const sessionWarningActive = useRef(false);
  const sessionEnding = useRef(false);

  useEffect(() => {
    checkSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => checkSession());
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('melhor_envio');
    if (!result) return;
    setAdminSection('settings');
    setSettingsMessage(result === 'connected' ? 'Melhor Envio conectado com sucesso.' : `Não foi possível conectar ao Melhor Envio${params.get('reason') ? `: ${params.get('reason')}` : '.'}`);
    params.delete('melhor_envio'); params.delete('reason');
    window.history.replaceState({}, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`);
  }, []);

  useEffect(() => {
    if (!session || !isAdmin || !settings) return undefined;
    const timeoutMs = Math.max(5, Number(settings.session_timeout_minutes) || 60) * 60 * 1000;
    const warningMs = Math.min(2 * 60 * 1000, timeoutMs / 2);
    lastAdminActivity.current = Date.now();
    sessionWarningActive.current = false;
    sessionEnding.current = false;
    setSessionWarningSeconds(null);

    const registerActivity = () => {
      if (!sessionWarningActive.current && !sessionEnding.current) lastAdminActivity.current = Date.now();
    };
    const activityEvents = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, registerActivity, { passive: true }));
    const timer = window.setInterval(async () => {
      const remainingMs = timeoutMs - (Date.now() - lastAdminActivity.current);
      if (remainingMs <= 0) {
        if (sessionEnding.current) return;
        sessionEnding.current = true;
        sessionWarningActive.current = false;
        setSessionWarningSeconds(null);
        await supabase.auth.signOut();
        clearAdminSession('Sua sessão expirou por inatividade. Faça login novamente.');
        return;
      }
      if (remainingMs <= warningMs) {
        sessionWarningActive.current = true;
        setSessionWarningSeconds(Math.ceil(remainingMs / 1000));
      }
    }, 1000);
    return () => {
      window.clearInterval(timer);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, registerActivity));
    };
  }, [session, isAdmin, settings?.session_timeout_minutes]);

  async function loadDashboard() {
    setDashboardLoading(true);
    const [productsResult, settingsResult, optionsResult, ordersResult] = await Promise.all([
      supabase.from('products').select(`
        id, slug, name, category, description, price, promotional_price, wholesale_price,
        wholesale_rule_mode, wholesale_minimum_quantity, image_url, size_guide_image_url, featured, show_in_promotions, active,
        shipping_weight_grams, shipping_height_cm, shipping_width_cm, shipping_length_cm,
        product_variants (
          id, color, print_pattern, image_url, sort_order, active,
          product_variant_stock (id, size, stock, sort_order),
          product_variant_images (id, image_url, sort_order, is_primary)
        )
      `).order('created_at', { ascending: false }),
      supabase.from('store_settings').select('id, store_name, whatsapp, minimum_wholesale_quantity, primary_color, session_timeout_minutes, origin_postal_code, package_weight_grams, packaging_tare_grams, package_height_cm, package_width_cm, package_length_cm, max_items_per_package, shipping_handling_days, shipping_markup_percent, melhor_envio_enabled, correios_enabled, sender_name, sender_email, sender_phone, sender_tax_id, sender_state_register, sender_address, sender_address_number, sender_address_complement, sender_district, sender_city, sender_state').limit(1).maybeSingle(),
      supabase.from('catalog_options').select('id, option_type, name, active').order('name'),
      supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }),
    ]);
    if (productsResult.error || settingsResult.error || optionsResult.error || ordersResult.error) {
      setMessage('Não foi possível carregar os dados do painel.');
      setDashboardLoading(false);
      return;
    }
    const normalized = (productsResult.data ?? []).map((p) => ({
      ...p,
      product_variants: [...(p.product_variants ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((v) => ({
        ...v,
        product_variant_stock: [...(v.product_variant_stock ?? [])].sort((a, b) => a.sort_order - b.sort_order),
        product_variant_images: [...(v.product_variant_images ?? [])].sort((a, b) => a.sort_order - b.sort_order),
      })),
    }));
    setProducts(normalized);
    setSettings(settingsResult.data ?? null);
    setWholesaleMinimumDraft(String(settingsResult.data?.minimum_wholesale_quantity ?? 6));
    setSessionTimeoutDraft(String(settingsResult.data?.session_timeout_minutes ?? 60));
    setStoreNameDraft(settingsResult.data?.store_name ?? 'CHIQUEHELITA');
    setWhatsappDraft(settingsResult.data?.whatsapp ?? '');
    setShippingDraft({
      originPostalCode:settingsResult.data?.origin_postal_code ?? '', weightGrams:String(settingsResult.data?.package_weight_grams ?? 500), packagingTareGrams:String(settingsResult.data?.packaging_tare_grams ?? 100),
      heightCm:String(settingsResult.data?.package_height_cm ?? 10), widthCm:String(settingsResult.data?.package_width_cm ?? 20), lengthCm:String(settingsResult.data?.package_length_cm ?? 30),
      maxItems:String(settingsResult.data?.max_items_per_package ?? 5), handlingDays:String(settingsResult.data?.shipping_handling_days ?? 1), markup:String(settingsResult.data?.shipping_markup_percent ?? 0),
      melhorEnvioEnabled:Boolean(settingsResult.data?.melhor_envio_enabled), correiosEnabled:Boolean(settingsResult.data?.correios_enabled),
    });
    setSenderDraft({ name:settingsResult.data?.sender_name ?? '', email:settingsResult.data?.sender_email ?? '', phone:settingsResult.data?.sender_phone ?? '', taxId:settingsResult.data?.sender_tax_id ?? '', stateRegister:settingsResult.data?.sender_state_register ?? '', address:settingsResult.data?.sender_address ?? '', number:settingsResult.data?.sender_address_number ?? '', complement:settingsResult.data?.sender_address_complement ?? '', district:settingsResult.data?.sender_district ?? '', city:settingsResult.data?.sender_city ?? '', state:settingsResult.data?.sender_state ?? '' });
    setCatalogOptions(optionsResult.data ?? []);
    const loadedOrders = ordersResult.data ?? [];
    setOrders(loadedOrders);
    setTrackingDrafts(Object.fromEntries(loadedOrders.map((order) => [order.id, {
      status: order.tracking_status ?? 'awaiting_shipment', code: order.tracking_code ?? '', url: order.tracking_url ?? '', externalId: order.shipping_external_id ?? '',
    }])));
    await loadMelhorEnvioStatus();
    setDashboardLoading(false);
  }

  async function loadMelhorEnvioStatus() {
    setMelhorEnvioConnection((current) => ({ ...current, loading: true }));
    const { data, error } = await supabase.functions.invoke('melhor-envio-oauth', { body: { action: 'status' } });
    if (error || !data) { setMelhorEnvioConnection({ loading: false, connected: false, expiresAt: null }); return; }
    setMelhorEnvioConnection({ loading: false, connected: Boolean(data.connected), expiresAt: data.expiresAt ?? null });
  }

  async function connectMelhorEnvio() {
    setSettingsMessage('Abrindo a autorização segura do Melhor Envio...');
    setMelhorEnvioConnection((current) => ({ ...current, loading: true }));
    const { data, error } = await supabase.functions.invoke('melhor-envio-oauth', { body: { action: 'start' } });
    if (error || !data?.authorizationUrl) {
      setMelhorEnvioConnection((current) => ({ ...current, loading: false }));
      setSettingsMessage('Não foi possível iniciar a autorização do Melhor Envio.'); return;
    }
    window.location.assign(data.authorizationUrl);
  }

  async function disconnectMelhorEnvio() {
    if (!window.confirm('Desconectar a conta do Melhor Envio? O cálculo automático ficará indisponível até uma nova autorização.')) return;
    setMelhorEnvioConnection((current) => ({ ...current, loading: true }));
    const { data, error } = await supabase.functions.invoke('melhor-envio-oauth', { body: { action: 'disconnect' } });
    if (error || data?.connected !== false) { setSettingsMessage('Não foi possível desconectar o Melhor Envio.'); await loadMelhorEnvioStatus(); return; }
    setMelhorEnvioConnection({ loading: false, connected: false, expiresAt: null });
    setSettingsMessage('Melhor Envio desconectado.');
  }

  async function checkSession() {
    setLoading(true);
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) {
      setSession(null); setIsAdmin(false); setLoading(false); return;
    }
    const { data: adminRecord, error } = await supabase.from('admin_users')
      .select('user_id, full_name, active').eq('user_id', currentSession.user.id).eq('active', true).maybeSingle();
    if (error || !adminRecord) {
      await supabase.auth.signOut();
      setSession(null); setIsAdmin(false); setMessage('Este usuário não possui acesso administrativo.'); setLoading(false); return;
    }
    setSession(currentSession); setIsAdmin(true); setLoading(false); await loadDashboard();
  }

  async function handleLogin(event) {
    event.preventDefault(); setMessage(''); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setMessage('E-mail ou senha inválidos.'); setLoading(false); return; }
    await checkSession();
  }
  async function handleLogout() {
    await supabase.auth.signOut();
    clearAdminSession();
  }
  function clearAdminSession(feedback = '') {
    sessionEnding.current = false; sessionWarningActive.current = false; setSessionWarningSeconds(null);
    setSession(null); setIsAdmin(false); setProducts([]); setOrders([]); setSettings(null); setCatalogOptions([]);
    if (feedback) setMessage(feedback);
  }
  function continueAdminSession() {
    if (sessionEnding.current || sessionWarningSeconds === null) return;
    lastAdminActivity.current = Date.now();
    sessionWarningActive.current = false;
    setSessionWarningSeconds(null);
  }

  async function updateOrderStatus(orderId, status) {
    setOrderSaving(orderId); setMessage('');
    const { error } = await supabase.rpc('update_order_status_with_inventory', { p_order_id: orderId, p_status: status });
    if (error) setMessage(error.message || 'Não foi possível atualizar o pedido.');
    else { setMessage(status === 'cancelled' ? 'Pedido cancelado. O estoque reservado foi devolvido quando aplicável.' : 'Status e estoque atualizados.'); await loadDashboard(); }
    setOrderSaving('');
  }
  async function saveOrderTracking(order) {
    const draft = trackingDrafts[order.id] ?? { status: 'awaiting_shipment', code: '', url: '', externalId: '' };
    const code = String(draft.code ?? '').trim().slice(0, 100);
    const url = String(draft.url ?? '').trim().slice(0, 500);
    const externalId = String(draft.externalId ?? '').trim().slice(0, 100);
    if (url && !/^https:\/\/[^\s]+$/i.test(url)) { setMessage('O link de rastreio deve começar com https://'); return; }
    setOrderSaving(order.id); setMessage('');
    const now = new Date().toISOString();
    const targetOrderStatus = ['posted', 'in_transit', 'out_for_delivery'].includes(draft.status) ? 'shipped' : draft.status === 'delivered' ? 'completed' : null;
    let statusData = null;
    if (targetOrderStatus && order.status !== targetOrderStatus) {
      const { data, error } = await supabase.rpc('update_order_status_with_inventory', { p_order_id: order.id, p_status: targetOrderStatus });
      if (error) { setMessage(error.message || 'Não foi possível reservar o estoque para esta entrega.'); setOrderSaving(''); return; }
      statusData = data;
    }
    const changes = {
      tracking_status: draft.status, tracking_code: code || null, tracking_url: url || null, shipping_external_id: externalId || null, tracking_updated_at: now, updated_at: now,
      ...(['posted', 'in_transit', 'out_for_delivery', 'delivered'].includes(draft.status) && !order.shipped_at ? { shipped_at: now } : {}),
      ...(draft.status === 'delivered' && !order.delivered_at ? { delivered_at: now } : {}),
    };
    const { data, error } = await supabase.from('orders').update(changes).eq('id', order.id).select('*').single();
    if (error) setMessage('Não foi possível salvar o acompanhamento da entrega.');
    else {
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, ...(statusData ?? {}), ...data, order_items: item.order_items } : item));
      setMessage(`Rastreio do pedido #${order.order_number} atualizado.`);
    }
    setOrderSaving('');
  }
  async function processShipment(order, action) {
    if (action === 'purchase' && !window.confirm(`Comprar e gerar a etiqueta do pedido #${order.order_number}? No ambiente de produção esta ação descontará o valor do saldo do Melhor Envio.`)) return;
    setOrderSaving(order.id); setMessage('');
    const { data, error } = await supabase.functions.invoke('manage-shipment', { body: { action, orderId: order.id } });
    if (error || data?.error) {
      let detail = data?.error;
      if (!detail && error?.context?.json) {
        try { detail = (await error.context.json())?.error; } catch { detail = ''; }
      }
      setMessage(detail || 'Não foi possível processar o envio no Melhor Envio.');
    } else {
      setMessage(action === 'prepare' ? `Envio do pedido #${order.order_number} adicionado ao carrinho.` : `Etiqueta do pedido #${order.order_number} comprada e gerada com sucesso.`);
      await loadDashboard();
      if (action === 'purchase' && data?.labelUrl) window.open(data.labelUrl, '_blank', 'noopener,noreferrer');
    }
    setOrderSaving('');
  }
  function toggleOrderDetails(orderId) {
    setExpandedOrderIds((current) => current.includes(orderId)
      ? current.filter((id) => id !== orderId)
      : [...current, orderId]);
  }

  function openNewProduct() {
    setEditingProductId(null);
    setProductForm(emptyProductForm());
    setProductTab('data');
    setProductFormMessage('');
    setUploadingImages({});
    setProductFormOpen(true);
  }
  function openEditProduct(product) {
    const variants = (product.product_variants ?? []).map((variant) => {
      const gallery = (variant.product_variant_images ?? []).map((img) => img.image_url).filter(Boolean);
      const fallback = variant.image_url ? [variant.image_url] : [];
      const images = gallery.length ? gallery : fallback;
      const primary = (variant.product_variant_images ?? []).find((img) => img.is_primary)?.image_url || variant.image_url || images[0] || '';
      return {
        id: variant.id,
        color: variant.color ?? '',
        printPattern: variant.print_pattern ?? '',
        images,
        primaryImageUrl: primary,
        stock: Object.fromEntries(SIZE_LABELS.map((size) => [size, variant.product_variant_stock.find((item) => item.size === size)?.stock ?? 0])),
      };
    });
    setEditingProductId(product.id);
    setProductForm({
      name: product.name ?? '', category: product.category ?? 'Vestidos', description: product.description ?? '',
      price: money(product.price), promotionalPrice: product.promotional_price == null ? '' : money(product.promotional_price),
      wholesalePrice: product.wholesale_price == null ? '' : money(product.wholesale_price),
      wholesaleRuleMode: product.wholesale_rule_mode ?? 'inherit', wholesaleMinimumQuantity: product.wholesale_minimum_quantity ?? '',
      shippingWeightGrams:product.shipping_weight_grams ?? '', shippingHeightCm:product.shipping_height_cm ?? '', shippingWidthCm:product.shipping_width_cm ?? '', shippingLengthCm:product.shipping_length_cm ?? '',
      imageUrl: product.image_url ?? '', sizeGuideImageUrl: product.size_guide_image_url ?? '', featured: Boolean(product.featured),
      showInPromotions: Boolean(product.show_in_promotions),
      active: Boolean(product.active), variants,
    });
    setProductTab('data');
    setProductFormMessage('');
    setUploadingImages({});
    setProductFormOpen(true);
  }
  function closeProductForm() {
    if (productSaving) return;
    setProductFormOpen(false); setEditingProductId(null); setProductFormMessage('');
  }
  function updateProductField(field, value) { setProductForm((current) => ({ ...current, [field]: value })); }
  function updateCurrencyField(field, value) { updateProductField(field, formatCurrencyInput(value)); }
  function addVariant(imageUrl = '') {
    setProductForm((current) => ({ ...current, variants: [...current.variants, makeVariant(imageUrl)] }));
  }
  function removeVariant(index) {
    setProductForm((current) => ({ ...current, variants: current.variants.filter((_, i) => i !== index) }));
  }
  function updateVariant(index, field, value) {
    setProductForm((current) => ({ ...current, variants: current.variants.map((v, i) => i === index ? { ...v, [field]: value } : v) }));
  }
  function updateVariantStock(index, size, value) {
    setProductForm((current) => ({
      ...current,
      variants: current.variants.map((v, i) => i === index ? { ...v, stock: { ...v.stock, [size]: value } } : v),
    }));
  }
  function removeVariantImage(index, imageUrl) {
    setProductForm((current) => ({
      ...current,
      variants: current.variants.map((v, i) => {
        if (i !== index) return v;
        const images = v.images.filter((url) => url !== imageUrl);
        return { ...v, images, primaryImageUrl: v.primaryImageUrl === imageUrl ? (images[0] || '') : v.primaryImageUrl };
      }),
    }));
  }

  function openOptionModal(type, variantIndex = null, option = null) {
    setOptionModal({ type, variantIndex, option }); setNewOptionName(option?.name ?? ''); setOptionMessage('');
  }
  function closeOptionModal() {
    if (optionSaving) return;
    setOptionModal(null); setNewOptionName(''); setOptionMessage('');
  }
  async function handleSaveOption(event) {
    event.preventDefault(); if (!optionModal) return;
    const name = newOptionName.trim();
    if (!name) { setOptionMessage(`Informe o nome da ${OPTION_LABELS[optionModal.type]}.`); return; }
    const exists = catalogOptions.some((item) => item.id !== optionModal.option?.id && item.option_type === optionModal.type && item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'));
    if (exists) { setOptionMessage(`Esta ${OPTION_LABELS[optionModal.type]} já está cadastrada.`); return; }
    setOptionSaving(true);
    if (optionModal.option) {
      const previousName = optionModal.option.name;
      const { data, error } = await supabase.from('catalog_options').update({ name, updated_at: new Date().toISOString() }).eq('id', optionModal.option.id).select('id, option_type, name, active').single();
      if (error || !data) { setOptionMessage('Não foi possível editar esta opção.'); setOptionSaving(false); return; }
      const referenceUpdate = optionModal.type === 'category'
        ? await supabase.from('products').update({ category: name, updated_at: new Date().toISOString() }).eq('category', previousName)
        : optionModal.type === 'color'
          ? await supabase.from('product_variants').update({ color: name, updated_at: new Date().toISOString() }).eq('color', previousName)
          : await supabase.from('product_variants').update({ print_pattern: name, updated_at: new Date().toISOString() }).eq('print_pattern', previousName);
      if (referenceUpdate.error) {
        await supabase.from('catalog_options').update({ name: previousName, updated_at: new Date().toISOString() }).eq('id', optionModal.option.id);
        setOptionMessage('Não foi possível atualizar os produtos que usam esta opção.'); setOptionSaving(false); return;
      }
      setCatalogOptions((current) => current.map((item) => item.id === data.id ? data : item));
      setProducts((current) => current.map((product) => optionModal.type === 'category'
        ? { ...product, category: product.category === previousName ? name : product.category }
        : { ...product, product_variants: product.product_variants.map((variant) => ({ ...variant, ...(optionModal.type === 'color' && variant.color === previousName ? { color: name } : {}), ...(optionModal.type === 'print' && variant.print_pattern === previousName ? { print_pattern: name } : {}) })) }));
      setOptionSaving(false); setOptionModal(null); setNewOptionName(''); setOptionMessage(''); setMessage(`${previousName} foi alterada para ${name}.`); return;
    }
    const { data, error } = await supabase.from('catalog_options').insert({ option_type: optionModal.type, name, active: true }).select('id, option_type, name, active').single();
    if (error || !data) {
      setOptionMessage(error?.code === '23505' ? 'Esta opção já existe.' : 'Não foi possível adicionar a opção.');
      setOptionSaving(false); return;
    }
    setCatalogOptions((current) => [...current, data]);
    if (optionModal.type === 'category') updateProductField('category', data.name);
    if (optionModal.type === 'color') updateVariant(optionModal.variantIndex, 'color', data.name);
    if (optionModal.type === 'print') updateVariant(optionModal.variantIndex, 'printPattern', data.name);
    setOptionSaving(false); setOptionModal(null); setNewOptionName(''); setOptionMessage('');
  }

  async function toggleCatalogOption(option) {
    const { error } = await supabase.from('catalog_options').update({ active: !option.active, updated_at: new Date().toISOString() }).eq('id', option.id);
    if (error) { setMessage('Não foi possível alterar esta opção.'); return; }
    setCatalogOptions((current) => current.map((item) => item.id === option.id ? { ...item, active: !item.active } : item));
    setMessage(`${option.name} ${option.active ? 'desativada' : 'ativada'} com sucesso.`);
  }
  function catalogOptionUsage(option) {
    if (option.option_type === 'category') return products.filter((product) => product.category === option.name).length;
    const productIds = new Set(products.filter((product) => product.product_variants.some((variant) => option.option_type === 'color' ? variant.color === option.name : variant.print_pattern === option.name)).map((product) => product.id));
    return productIds.size;
  }
  async function deleteCatalogOption(option) {
    const usage = catalogOptionUsage(option);
    if (usage > 0) { setMessage(`Não é possível excluir ${option.name}: esta opção é usada em ${usage} produto(s). Você pode desativá-la.`); return; }
    if (!window.confirm(`Excluir definitivamente “${option.name}”? Esta ação não poderá ser desfeita.`)) return;
    const { error } = await supabase.from('catalog_options').delete().eq('id', option.id);
    if (error) { setMessage('Não foi possível excluir esta opção.'); return; }
    setCatalogOptions((current) => current.filter((item) => item.id !== option.id));
    setMessage(`${option.name} foi excluída com sucesso.`);
  }

  async function handleSaveSettings(event) {
    event.preventDefault();
    const minimum = Number(wholesaleMinimumDraft);
    const sessionTimeoutMinutes = Number(sessionTimeoutDraft);
    const storeName = storeNameDraft.trim();
    const whatsapp = whatsappDraft.replace(/\D/g, '');
    const originPostalCode = shippingDraft.originPostalCode.replace(/\D/g, '');
    const sender = { sender_name:senderDraft.name.trim(), sender_email:senderDraft.email.trim().toLowerCase(), sender_phone:senderDraft.phone.replace(/\D/g,''), sender_tax_id:senderDraft.taxId.replace(/\D/g,''), sender_state_register:senderDraft.stateRegister.trim() || 'ISENTO', sender_address:senderDraft.address.trim(), sender_address_number:senderDraft.number.trim(), sender_address_complement:senderDraft.complement.trim() || null, sender_district:senderDraft.district.trim(), sender_city:senderDraft.city.trim(), sender_state:senderDraft.state.trim().toUpperCase() };
    const shippingNumbers = {
      package_weight_grams:Number(shippingDraft.weightGrams), packaging_tare_grams:Number(shippingDraft.packagingTareGrams), package_height_cm:Number(shippingDraft.heightCm), package_width_cm:Number(shippingDraft.widthCm),
      package_length_cm:Number(shippingDraft.lengthCm), max_items_per_package:Number(shippingDraft.maxItems), shipping_handling_days:Number(shippingDraft.handlingDays), shipping_markup_percent:Number(shippingDraft.markup),
    };
    setSettingsMessage('');
    if (!Number.isInteger(minimum) || minimum < 1) {
      setSettingsMessage('Informe uma quantidade mínima válida, com pelo menos 1 peça.'); return;
    }
    if (!Number.isInteger(sessionTimeoutMinutes) || sessionTimeoutMinutes < 5 || sessionTimeoutMinutes > 480) {
      setSettingsMessage('Informe um tempo de sessão entre 5 e 480 minutos.'); return;
    }
    if (storeName.length < 2) { setSettingsMessage('Informe o nome comercial da loja.'); return; }
    if (!/^\d{10,15}$/.test(whatsapp)) { setSettingsMessage('Informe o WhatsApp com código do país e DDD, somente números.'); return; }
    if ((shippingDraft.melhorEnvioEnabled || shippingDraft.correiosEnabled) && !/^\d{8}$/.test(originPostalCode)) { setSettingsMessage('Informe um CEP de origem válido para ativar o frete.'); return; }
    if (shippingDraft.melhorEnvioEnabled && (!sender.sender_name || !/^\S+@\S+\.\S+$/.test(sender.sender_email) || !/^\d{10,15}$/.test(sender.sender_phone) || !/^(\d{11}|\d{14})$/.test(sender.sender_tax_id) || !sender.sender_address || !sender.sender_address_number || !sender.sender_district || !sender.sender_city || !/^[A-Z]{2}$/.test(sender.sender_state))) { setSettingsMessage('Complete corretamente todos os dados obrigatórios do remetente para usar o Melhor Envio.'); return; }
    if (![shippingNumbers.package_weight_grams,shippingNumbers.package_height_cm,shippingNumbers.package_width_cm,shippingNumbers.package_length_cm,shippingNumbers.max_items_per_package].every((value) => Number.isFinite(value) && value > 0) || !Number.isFinite(shippingNumbers.packaging_tare_grams) || shippingNumbers.packaging_tare_grams < 0 || !Number.isInteger(shippingNumbers.shipping_handling_days) || shippingNumbers.shipping_handling_days < 0 || !Number.isFinite(shippingNumbers.shipping_markup_percent) || shippingNumbers.shipping_markup_percent < 0) { setSettingsMessage('Revise peso, embalagem, dimensões, quantidade por pacote, prazo e acréscimo do frete.'); return; }
    if (!settings?.id) { setSettingsMessage('Não foi possível identificar as configurações da loja.'); return; }
    setSettingsSaving(true);
    const { data, error } = await supabase.from('store_settings').update({ store_name: storeName, whatsapp, minimum_wholesale_quantity: minimum, session_timeout_minutes:sessionTimeoutMinutes, origin_postal_code:originPostalCode, ...shippingNumbers, ...sender, melhor_envio_enabled:shippingDraft.melhorEnvioEnabled, correios_enabled:shippingDraft.correiosEnabled })
      .eq('id', settings.id).select('*').single();
    if (error || !data) {
      setSettingsMessage('Não foi possível salvar a nova regra geral de atacado.'); setSettingsSaving(false); return;
    }
    setSettings(data); setWholesaleMinimumDraft(String(data.minimum_wholesale_quantity)); setSessionTimeoutDraft(String(data.session_timeout_minutes)); setStoreNameDraft(data.store_name); setWhatsappDraft(data.whatsapp);
    setShippingDraft({ originPostalCode:data.origin_postal_code ?? '', weightGrams:String(data.package_weight_grams), packagingTareGrams:String(data.packaging_tare_grams), heightCm:String(data.package_height_cm), widthCm:String(data.package_width_cm), lengthCm:String(data.package_length_cm), maxItems:String(data.max_items_per_package), handlingDays:String(data.shipping_handling_days), markup:String(data.shipping_markup_percent), melhorEnvioEnabled:data.melhor_envio_enabled, correiosEnabled:data.correios_enabled });
    setSenderDraft({ name:data.sender_name ?? '', email:data.sender_email ?? '', phone:data.sender_phone ?? '', taxId:data.sender_tax_id ?? '', stateRegister:data.sender_state_register ?? '', address:data.sender_address ?? '', number:data.sender_address_number ?? '', complement:data.sender_address_complement ?? '', district:data.sender_district ?? '', city:data.sender_city ?? '', state:data.sender_state ?? '' });
    setSettingsMessage('Configurações comerciais e logísticas atualizadas com sucesso.'); setSettingsSaving(false);
  }

  async function uploadFile(file, uploadKey) {
    if (!file) return null;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setProductFormMessage('Use imagens JPG, PNG ou WEBP.'); return null;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setProductFormMessage('Cada imagem deve ter no máximo 5 MB.'); return null;
    }
    setUploadingImages((current) => ({ ...current, [uploadKey]: true }));
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileBase = slugify(file.name.replace(/\.[^.]+$/, '')) || 'imagem';
    const path = `${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileBase}.${extension}`;
    const { data, error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: file.type,
    });
    setUploadingImages((current) => ({ ...current, [uploadKey]: false }));
    if (error || !data) { setProductFormMessage('Não foi possível enviar uma das imagens. Tente novamente.'); return null; }
    return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(data.path).data?.publicUrl || null;
  }

  async function uploadSingleImage(file, target) {
    const url = await uploadFile(file, target);
    if (!url) return;
    if (target === 'main') updateProductField('imageUrl', url);
    if (target === 'guide') updateProductField('sizeGuideImageUrl', url);
  }

  async function uploadDressPhotos(files) {
    const list = [...(files ?? [])];
    if (!list.length) return;
    setProductFormMessage('');
    const urls = [];
    for (let i = 0; i < list.length; i += 1) {
      const url = await uploadFile(list[i], `dress-${Date.now()}-${i}`);
      if (url) urls.push(url);
    }
    if (urls.length) {
      setProductForm((current) => ({ ...current, variants: [...current.variants, ...urls.map((url) => makeVariant(url))] }));
    }
  }

  async function uploadVariantPhotos(files, variantIndex) {
    const list = [...(files ?? [])];
    if (!list.length) return;
    const urls = [];
    for (let i = 0; i < list.length; i += 1) {
      const url = await uploadFile(list[i], `variant-${variantIndex}-${Date.now()}-${i}`);
      if (url) urls.push(url);
    }
    if (!urls.length) return;
    setProductForm((current) => ({
      ...current,
      variants: current.variants.map((v, i) => i === variantIndex
        ? { ...v, images: [...v.images, ...urls], primaryImageUrl: v.primaryImageUrl || urls[0] }
        : v),
    }));
  }

  async function handleSaveProduct(event) {
    event.preventDefault();
    setProductFormMessage('');
    const name = productForm.name.trim();
    const slug = slugify(name);
    const price = parseCurrencyInput(productForm.price);
    const promotionalPrice = parseCurrencyInput(productForm.promotionalPrice);
    const wholesalePrice = parseCurrencyInput(productForm.wholesalePrice);
    const wholesaleMinimum = productForm.wholesaleRuleMode === 'product' ? Number(productForm.wholesaleMinimumQuantity) : null;
    const shippingValues = [productForm.shippingWeightGrams,productForm.shippingHeightCm,productForm.shippingWidthCm,productForm.shippingLengthCm];
    const hasAnyShippingValue = shippingValues.some((value) => String(value).trim() !== '');
    const normalizedShipping = shippingValues.map((value) => String(value).trim() === '' ? null : Number(value));
    if (!name || !slug || price === null || price < 0) { setProductFormMessage('Preencha o nome e o preço de varejo corretamente.'); setProductTab('data'); return; }
    if (!productForm.category) { setProductFormMessage('Selecione uma categoria.'); setProductTab('data'); return; }
    if (productForm.wholesaleRuleMode !== 'disabled' && wholesalePrice === null) { setProductFormMessage('Informe o preço de atacado ou escolha “Sem atacado”.'); setProductTab('data'); return; }
    if (productForm.wholesaleRuleMode === 'product' && (!wholesaleMinimum || wholesaleMinimum < 1)) { setProductFormMessage('Informe a quantidade mínima da regra específica.'); setProductTab('data'); return; }
    if (hasAnyShippingValue && normalizedShipping.some((value) => !Number.isFinite(value) || value <= 0)) { setProductFormMessage('Preencha peso e todas as dimensões logísticas, ou deixe todos vazios para usar o padrão da loja.'); setProductTab('data'); return; }
    if (!productForm.variants.length) { setProductFormMessage('Adicione pelo menos uma foto/variação do vestido.'); setProductTab('variations'); return; }
    const normalizedVariants = productForm.variants.map((v) => ({ ...v, color: v.color.trim(), printPattern: v.printPattern.trim() }));
    if (normalizedVariants.some((v) => !v.color || !v.printPattern)) { setProductFormMessage('Informe cor e estampa em todas as variações.'); setProductTab('variations'); return; }
    const keys = normalizedVariants.map((v) => `${v.color.toLowerCase()}::${v.printPattern.toLowerCase()}`);
    if (new Set(keys).size !== keys.length) { setProductFormMessage('Há duas variações com a mesma cor e estampa. Use “Adicionar fotos” dentro de uma única variação para fotos extras.'); setProductTab('variations'); return; }
    if (Object.values(uploadingImages).some(Boolean)) { setProductFormMessage('Aguarde o envio das imagens terminar antes de salvar.'); return; }

    setProductSaving(true);
    const firstVariantImage = normalizedVariants.find((v) => v.primaryImageUrl)?.primaryImageUrl || normalizedVariants.flatMap((v) => v.images)[0] || null;
    const payload = {
      slug, name, category: productForm.category, description: productForm.description.trim() || null,
      price, promotional_price: promotionalPrice,
      wholesale_price: productForm.wholesaleRuleMode === 'disabled' ? null : wholesalePrice,
      wholesale_rule_mode: productForm.wholesaleRuleMode, wholesale_minimum_quantity: wholesaleMinimum,
      image_url: productForm.imageUrl || firstVariantImage,
      size_guide_image_url: productForm.sizeGuideImageUrl || null,
      shipping_weight_grams:hasAnyShippingValue ? normalizedShipping[0] : null, shipping_height_cm:hasAnyShippingValue ? normalizedShipping[1] : null,
      shipping_width_cm:hasAnyShippingValue ? normalizedShipping[2] : null, shipping_length_cm:hasAnyShippingValue ? normalizedShipping[3] : null,
      featured: productForm.featured, show_in_promotions: productForm.showInPromotions, active: productForm.active,
    };

    let productId = editingProductId;
    if (editingProductId) {
      const { error } = await supabase.from('products').update(payload).eq('id', editingProductId);
      if (error) {
        setProductFormMessage(error.code === '23505' ? 'Já existe outro produto com este nome/identificador.' : 'Não foi possível salvar as alterações do produto.');
        setProductSaving(false); return;
      }
    } else {
      const { data, error } = await supabase.from('products').insert(payload).select('id').single();
      if (error || !data) {
        setProductFormMessage(error?.code === '23505' ? 'Já existe um produto com este nome/identificador.' : 'Não foi possível cadastrar o produto.');
        setProductSaving(false); return;
      }
      productId = data.id;
    }

    try {
      const savedVariantIds = [];
      for (let index = 0; index < normalizedVariants.length; index += 1) {
        const variant = normalizedVariants[index];
        const primaryImage = variant.primaryImageUrl || variant.images[0] || null;
        const variantPayload = {
          product_id: productId, color: variant.color, print_pattern: variant.printPattern,
          image_url: primaryImage, sort_order: index, active: true,
        };
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

        const stockPayload = SIZE_LABELS.map((size, sizeIndex) => ({
          variant_id: variantId, size, stock: Math.max(0, Number(variant.stock[size]) || 0), sort_order: sizeIndex,
        }));
        const { error: stockError } = await supabase.from('product_variant_stock').upsert(stockPayload, { onConflict: 'variant_id,size' });
        if (stockError) throw stockError;

        const { error: deleteImagesError } = await supabase.from('product_variant_images').delete().eq('variant_id', variantId);
        if (deleteImagesError) throw deleteImagesError;
        if (variant.images.length) {
          const galleryPayload = variant.images.map((url, imageIndex) => ({
            variant_id: variantId, image_url: url, sort_order: imageIndex, is_primary: url === primaryImage,
          }));
          const { error: galleryError } = await supabase.from('product_variant_images').insert(galleryPayload);
          if (galleryError) throw galleryError;
        }
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
      setProductFormMessage(editingProductId
        ? 'O produto foi atualizado, mas ocorreu um erro ao salvar fotos, variações ou estoque. Revise e tente novamente.'
        : 'O produto não pôde ser salvo porque ocorreu um erro nas fotos, variações ou estoque.');
      setProductSaving(false); return;
    }

    setProductSaving(false);
    setProductFormOpen(false);
    setMessage(editingProductId ? 'Produto atualizado com sucesso.' : 'Produto cadastrado com sucesso.');
    setEditingProductId(null);
    await loadDashboard();
  }

  async function handleToggleProductActive() {
    if (!editingProductId) return;
    const newActive = !productForm.active;
    setProductSaving(true); setProductFormMessage('');
    const { error } = await supabase.from('products').update({ active: newActive }).eq('id', editingProductId);
    if (error) { setProductFormMessage('Não foi possível alterar o status do produto.'); setProductSaving(false); return; }
    setProductSaving(false); setProductFormOpen(false); setEditingProductId(null);
    setMessage(newActive ? 'Produto ativado e disponível na vitrine.' : 'Produto desativado e removido da vitrine.');
    await loadDashboard();
  }

  const optionLists = useMemo(() => {
    const fromCatalog = (type) => catalogOptions.filter((i) => i.option_type === type && i.active).map((i) => i.name);
    const variants = products.flatMap((p) => p.product_variants ?? []);
    return {
      categories: uniqueSorted(['Vestidos', ...fromCatalog('category'), ...products.map((p) => p.category)]),
      colors: uniqueSorted([...fromCatalog('color'), ...variants.map((v) => v.color)]),
      prints: uniqueSorted([...fromCatalog('print'), ...variants.map((v) => v.print_pattern)]),
    };
  }, [catalogOptions, products]);

  const metrics = useMemo(() => ({
    totalProducts: products.length,
    activeProducts: products.filter((p) => p.active).length,
    totalStock: products.reduce((sum, p) => sum + p.product_variants.reduce((vs, v) => vs + v.product_variant_stock.reduce((ss, item) => ss + item.stock, 0), 0), 0),
    newOrders: orders.filter((order) => order.status === 'new').length,
  }), [products, orders]);

  const filteredOrders = useMemo(() => {
    const term = orderSearch.trim().toLocaleLowerCase('pt-BR');
    return orders.filter((order) => {
      const matchesStatus = orderStatusFilter === 'all' || order.status === orderStatusFilter;
      const searchable = [order.order_number, order.customer_name, order.customer_email, order.customer_tax_id, order.customer_phone, order.city].join(' ').toLocaleLowerCase('pt-BR');
      return matchesStatus && (!term || searchable.includes(term));
    });
  }, [orders, orderSearch, orderStatusFilter]);
  const orderMetrics = useMemo(() => {
    const valid = orders.filter((order) => order.status !== 'cancelled');
    const completed = orders.filter((order) => order.status === 'completed');
    return {
      total: orders.length,
      open: orders.filter((order) => !['completed', 'cancelled'].includes(order.status)).length,
      completedRevenue: completed.reduce((sum, order) => sum + Number(order.total_amount), 0),
      averageTicket: valid.length ? valid.reduce((sum, order) => sum + Number(order.total_amount), 0) / valid.length : 0,
    };
  }, [orders]);
  const clients = useMemo(() => {
    const grouped = new Map();
    orders.filter((order) => order.status !== 'cancelled').forEach((order) => {
      const key = order.customer_tax_id;
      const current = grouped.get(key) ?? { taxId:key, name:order.customer_name, email:order.customer_email, phone:order.customer_phone, city:order.city, state:order.state, orders:0, total:0, lastOrder:order.created_at };
      current.orders += 1; current.total += Number(order.total_amount);
      if (new Date(order.created_at) > new Date(current.lastOrder)) { current.lastOrder = order.created_at; current.name = order.customer_name; current.email = order.customer_email; current.phone = order.customer_phone; current.city = order.city; current.state = order.state; }
      grouped.set(key, current);
    });
    const term = clientSearch.trim().toLocaleLowerCase('pt-BR');
    return [...grouped.values()].filter((client) => !term || [client.name,client.email,client.phone,client.taxId,client.city].join(' ').toLocaleLowerCase('pt-BR').includes(term)).sort((a,b) => new Date(b.lastOrder) - new Date(a.lastOrder));
  }, [orders, clientSearch]);

  const productTotalStock = useMemo(() => productForm.variants.reduce(
    (sum, variant) => sum + SIZE_LABELS.reduce((subtotal, size) => subtotal + (Number(variant.stock[size]) || 0), 0), 0,
  ), [productForm.variants]);

  if (loading) return <BrandLoader message="Carregando painel administrativo..."/>;
  if (!session || !isAdmin) return (
    <main className="admin-login-page"><section className="admin-login-card">
      <img src={logo} alt="Chique Helita" className="admin-logo"/>
      <div className="admin-login-heading"><LockKeyhole size={24}/><div><h1>Painel Administrativo</h1><p>Acesso exclusivo da administração</p></div></div>
      <form onSubmit={handleLogin} className="admin-login-form">
        <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required/></label>
        <label>Senha<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required/></label>
        {message && <p className="admin-message">{message}</p>}
        <button type="submit" className="admin-primary-button">Entrar no painel</button>
      </form>
    </section></main>
  );

  const generalMinimum = settings?.minimum_wholesale_quantity ?? 6;
  const SelectWithAdd = ({ label, value, onChange, options, type, variantIndex = null, required = false }) => (
    <label>{label}<div className="admin-select-add">
      <select value={value} onChange={(e) => onChange(e.target.value)} required={required}>
        <option value="">Selecione...</option>{options.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <button type="button" className="admin-add-option-button" onClick={() => openOptionModal(type, variantIndex)} title={`Adicionar ${OPTION_LABELS[type]}`}><Plus size={18}/></button>
    </div></label>
  );

  const SingleImageField = ({ label, value, target }) => (
    <label className="admin-image-field">{label}<div className="admin-image-upload-box">
      {value ? <img src={value} alt={label} className="admin-image-preview"/> : <div className="admin-image-placeholder"><ImagePlus size={28}/><span>Nenhuma imagem selecionada</span></div>}
      <div className="admin-image-upload-actions">
        <label className="admin-upload-button"><Upload size={16}/>{value ? 'Trocar imagem' : 'Escolher imagem'}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => uploadSingleImage(e.target.files?.[0], target)}/>
        </label>
        {value && <button type="button" className="admin-remove-image-button" onClick={() => updateProductField(target === 'main' ? 'imageUrl' : 'sizeGuideImageUrl', '')}>Remover</button>}
      </div>
    </div></label>
  );

  const sidebarItems = [
    ['dashboard', <Home size={18}/>, 'Dashboard'],
    ['orders', <ShoppingBag size={18}/>, 'Pedidos'],
    ['products', <Boxes size={18}/>, 'Produtos'],
    ['categories', <Tags size={18}/>, 'Opções'],
    ['clients', <Users size={18}/>, 'Clientes'],
    ['settings', <Settings size={18}/>, 'Configurações'],
  ];

  return (
    <main className="admin-dashboard admin-pro-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand"><img src={logo} alt="Chique Helita"/><div><strong>Chique Helita</strong><span>Painel Administrativo</span></div></div>
        <nav>{sidebarItems.map(([key, icon, label, soon]) => (
          <button key={key} type="button" className={adminSection === key ? 'active' : ''} onClick={() => { if (soon) setMessage(`${label}: módulo preparado para uma próxima etapa.`); else setAdminSection(key); }}>
            {icon}<span>{label}</span>{soon && <small>Em breve</small>}
          </button>
        ))}</nav>
        <button className="admin-sidebar-logout" type="button" onClick={handleLogout}><LogOut size={18}/>Sair</button>
      </aside>

      <div className="admin-main-area">
        <header className="admin-topbar">
          <div><p className="admin-eyebrow">CHIQUE HELITA</p><h1>{adminSection === 'products' ? 'Produtos' : adminSection === 'orders' ? 'Pedidos' : adminSection === 'clients' ? 'Clientes' : adminSection === 'categories' ? 'Opções de produtos' : adminSection === 'settings' ? 'Configurações' : 'Dashboard'}</h1></div>
          <div className="admin-header-actions">
            <button className="admin-topbar-button" onClick={loadDashboard} disabled={dashboardLoading}><RefreshCw size={17} className={dashboardLoading ? 'admin-spin-icon' : ''}/>Atualizar</button>
            {adminSection === 'products' && <button className="admin-primary-button" type="button" onClick={openNewProduct}><Plus size={17}/>Novo produto</button>}
          </div>
        </header>

        <div className="admin-content">
          {message && <p className="admin-success-message">{message}</p>}

          {adminSection === 'dashboard' && <>
            <section className="admin-welcome"><ShieldCheck size={32}/><div><p className="admin-eyebrow">VISÃO GERAL</p><h2>Bem-vindo ao painel</h2><p>Gerencie produtos, estoque e regras comerciais em um só lugar.</p></div></section>
            <section className="admin-metrics">
              <article><ShoppingBag size={22}/><span>Pedidos novos</span><strong>{metrics.newOrders}</strong></article>
              <article><PackageCheck size={22}/><span>Produtos ativos</span><strong>{metrics.activeProducts}</strong></article>
              <article><Boxes size={22}/><span>Peças em estoque</span><strong>{metrics.totalStock}</strong></article>
              <article><CircleDollarSign size={22}/><span>Mínimo atacado geral</span><strong>{generalMinimum}</strong></article>
            </section>
            <section className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-eyebrow">ATALHO</p><h2>Catálogo</h2><p>Acesse os produtos para cadastrar, editar fotos e atualizar o estoque.</p></div><button className="admin-primary-button" onClick={() => setAdminSection('products')}>Abrir produtos</button></div></section>
          </>}

          {adminSection === 'orders' && <section className="admin-panel">
            <div className="admin-panel-heading"><div><p className="admin-eyebrow">ATENDIMENTO</p><h2>Pedidos recebidos</h2><p>Consulte o cadastro, os itens e acompanhe cada etapa do pedido.</p></div></div>
            <div className="admin-order-metrics"><article><span>Total de pedidos</span><strong>{orderMetrics.total}</strong></article><article><span>Em andamento</span><strong>{orderMetrics.open}</strong></article><article><span>Faturamento concluído</span><strong>{money(orderMetrics.completedRevenue)}</strong></article><article><span>Ticket médio</span><strong>{money(orderMetrics.averageTicket)}</strong></article></div>
            <div className="admin-order-filters"><label>Buscar pedido<input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Nome, nº, CPF/CNPJ, telefone ou cidade"/></label><label>Status<select value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value)}><option value="all">Todos os status</option>{Object.entries(ORDER_STATUSES).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><span>{filteredOrders.length} de {orders.length} pedidos</span></div>
            {dashboardLoading ? <div className="admin-inline-loading"><div className="admin-spinner"/><span>Atualizando pedidos...</span></div> : orders.length === 0 ? <div className="admin-empty-state">Nenhum pedido recebido até o momento.</div> : filteredOrders.length === 0 ? <div className="admin-empty-state">Nenhum pedido corresponde aos filtros.</div> : <div className="admin-order-list">{filteredOrders.map((order) => {
              const expanded = expandedOrderIds.includes(order.id);
              const detailsId = `order-details-${order.id}`;
              return <article className={`admin-order-card ${expanded ? 'expanded' : ''}`} key={order.id}>
                <button type="button" className="admin-order-summary" onClick={() => toggleOrderDetails(order.id)} aria-expanded={expanded} aria-controls={detailsId}>
                  <div className="admin-order-summary-main"><span className={`admin-order-status status-${order.status}`}>{ORDER_STATUSES[order.status]}</span><div><h3>Pedido #{order.order_number}</h3><small>{new Date(order.created_at).toLocaleString('pt-BR')} · {order.customer_name}</small></div></div>
                  <div className="admin-order-summary-total"><strong>{money(order.total_amount)}</strong><span>{expanded ? 'Ocultar detalhes' : 'Ver detalhes'}</span><ChevronDown size={20}/></div>
                </button>
                {expanded && <div className="admin-order-details" id={detailsId}>
                  <div className="admin-order-columns"><div><h4>Cliente</h4><p><strong>{order.customer_name}</strong></p><p>{order.customer_email || 'E-mail não informado'}</p><p>{order.customer_phone}</p><p>CPF/CNPJ: {order.customer_tax_id}</p></div><div><h4>Entrega</h4><p>{order.address}, {order.address_number}</p><p>{order.district} · {order.city}/{order.state}</p><p>CEP {order.postal_code}</p><p>{order.fulfillment === 'delivery' ? 'Entrega' : 'Retirada'} · {order.payment_method}</p>{order.shipping_service_name && <p><strong>{order.shipping_company} · {order.shipping_service_name}</strong><br/>Prazo: {order.shipping_delivery_min_days === order.shipping_delivery_max_days ? `${order.shipping_delivery_max_days} dias úteis` : `${order.shipping_delivery_min_days} a ${order.shipping_delivery_max_days} dias úteis`}</p>}</div></div>
                  <div className="admin-order-items">{(order.order_items ?? []).map((item) => <div key={item.id}><span>{item.quantity}x {item.product_name}<small>{item.color} · {item.print_pattern} · Tam. {item.size}</small></span><strong>{money(item.subtotal)}</strong></div>)}</div>
                  <div className="admin-order-totals"><span>Produtos</span><strong>{money(order.products_amount ?? order.total_amount)}</strong><span>Frete</span><strong>{order.fulfillment === 'delivery' ? money(order.shipping_price ?? 0) : 'Retirada'}</strong><b>Total do pedido</b><b>{money(order.total_amount)}</b></div>
                  {order.fulfillment === 'delivery' && <section className="admin-order-tracking"><div className="admin-order-tracking-heading"><div><strong>Acompanhamento da entrega</strong><span>{order.shipping_external_id ? 'Atualização automática vinculada ao Melhor Envio.' : 'Prepare a etiqueta para ativar as atualizações automáticas.'}</span></div><span className={`tracking-status tracking-${order.tracking_status ?? 'awaiting_shipment'}`}>{TRACKING_STATUSES[order.tracking_status ?? 'awaiting_shipment']}</span></div>{order.shipping_provider === 'melhor_envio' && <div className="admin-shipment-flow"><div><strong>Etiqueta do Melhor Envio</strong><span>{order.shipping_generated_at ? 'Etiqueta pronta para impressão.' : order.shipping_external_id ? 'No carrinho — aguardando compra e geração.' : order.inventory_committed_at ? 'Pedido confirmado — pronto para preparar.' : 'Confirme o pedido para reservar o estoque e liberar a etiqueta.'}</span></div><div>{order.shipping_label_url ? <a className="admin-secondary-button" href={order.shipping_label_url} target="_blank" rel="noreferrer">Abrir etiqueta</a> : order.shipping_external_id ? <button type="button" className="admin-primary-button" disabled={orderSaving === order.id} onClick={() => processShipment(order, 'purchase')}>{orderSaving === order.id ? 'Processando...' : 'Comprar e gerar etiqueta'}</button> : <button type="button" className="admin-primary-button" disabled={orderSaving === order.id || !order.inventory_committed_at || order.status === 'cancelled'} onClick={() => processShipment(order, 'prepare')}>{orderSaving === order.id ? 'Preparando...' : 'Adicionar ao carrinho de envios'}</button>}</div></div>}<div className="admin-order-tracking-fields"><label>Status da entrega<select value={trackingDrafts[order.id]?.status ?? 'awaiting_shipment'} onChange={(event) => setTrackingDrafts((current) => ({ ...current, [order.id]: { ...current[order.id], status: event.target.value } }))}>{Object.entries(TRACKING_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Código de rastreio<input value={trackingDrafts[order.id]?.code ?? ''} onChange={(event) => setTrackingDrafts((current) => ({ ...current, [order.id]: { ...current[order.id], code: event.target.value } }))} placeholder="Ex.: AA123456789BR" maxLength="100"/></label><label className="tracking-url-field">Link de acompanhamento<input type="url" value={trackingDrafts[order.id]?.url ?? ''} onChange={(event) => setTrackingDrafts((current) => ({ ...current, [order.id]: { ...current[order.id], url: event.target.value } }))} placeholder="https://..." maxLength="500"/></label><label className="tracking-external-id">ID da etiqueta no Melhor Envio<input value={trackingDrafts[order.id]?.externalId ?? ''} onChange={(event) => setTrackingDrafts((current) => ({ ...current, [order.id]: { ...current[order.id], externalId: event.target.value } }))} placeholder="Preenchido automaticamente ao preparar a etiqueta" maxLength="100"/></label></div><div className="admin-order-tracking-actions">{order.shipping_label_status && <span>Último evento: <strong>{order.shipping_label_status}</strong></span>}{order.tracking_url && <a href={order.tracking_url} target="_blank" rel="noreferrer">Abrir rastreamento</a>}<button type="button" className="admin-primary-button" disabled={orderSaving === order.id} onClick={() => saveOrderTracking(order)}><Save size={15}/>{orderSaving === order.id ? 'Salvando...' : 'Salvar rastreio'}</button></div></section>}
                  {order.notes && <p className="admin-order-notes"><strong>Observações:</strong> {order.notes}</p>}
                  <footer><span>{order.total_quantity} peças</span><label>Status<select value={order.status} disabled={orderSaving === order.id} onChange={(event) => updateOrderStatus(order.id, event.target.value)}>{Object.entries(ORDER_STATUSES).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label></footer>
                </div>}
              </article>;
            })}</div>}
          </section>}

          {adminSection === 'clients' && <section className="admin-panel">
            <div className="admin-panel-heading"><div><p className="admin-eyebrow">RELACIONAMENTO</p><h2>Clientes</h2><p>Visão consolidada a partir dos pedidos não cancelados.</p></div></div>
            <div className="admin-client-search"><label>Buscar cliente<input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Nome, e-mail, CPF/CNPJ, telefone ou cidade"/></label><span>{clients.length} clientes encontrados</span></div>
            {clients.length === 0 ? <div className="admin-empty-state">Nenhum cliente corresponde à busca.</div> : <div className="admin-client-grid">{clients.map((client) => <article className="admin-client-card" key={client.taxId}><header><div className="admin-client-avatar">{client.name.split(/\s+/).slice(0,2).map((part) => part[0]).join('').toUpperCase()}</div><div><h3>{client.name}</h3><span>{client.city}/{client.state}</span></div></header><div className="admin-client-contact"><p>{client.email}</p><p>{client.phone}</p><p>CPF/CNPJ: {client.taxId}</p></div><div className="admin-client-stats"><div><span>Pedidos</span><strong>{client.orders}</strong></div><div><span>Total comprado</span><strong>{money(client.total)}</strong></div></div><footer>Última compra: {new Date(client.lastOrder).toLocaleDateString('pt-BR')}</footer></article>)}</div>}
          </section>}

          {adminSection === 'categories' && <section className="admin-panel">
            <div className="admin-panel-heading"><div><p className="admin-eyebrow">ORGANIZAÇÃO</p><h2>Opções de produtos</h2><p>Gerencie as categorias, cores e estampas usadas no cadastro dos produtos.</p></div></div>
            <div className="admin-catalog-columns">{[['category','Categorias'],['color','Cores'],['print','Estampas']].map(([type,title]) => {
              const typeOptions = catalogOptions.filter((item) => item.option_type === type);
              const search = catalogSearch[type].trim().toLocaleLowerCase('pt-BR');
              const visibleOptions = typeOptions.filter((item) => !search || item.name.toLocaleLowerCase('pt-BR').includes(search));
              const activeCount = typeOptions.filter((item) => item.active).length;
              return <article key={type}><header><div><h3>{title}</h3><span>{activeCount} ativas · {typeOptions.length} no total</span></div><button className="admin-primary-button" type="button" onClick={() => openOptionModal(type)}><Plus size={15}/>Adicionar</button></header>
                <label className="admin-catalog-search"><Search size={15}/><input value={catalogSearch[type]} onChange={(event) => setCatalogSearch((current) => ({ ...current, [type]: event.target.value }))} placeholder={`Buscar em ${title.toLocaleLowerCase('pt-BR')}`} aria-label={`Buscar ${title.toLocaleLowerCase('pt-BR')}`}/></label>
                <div className="admin-catalog-list">{visibleOptions.length === 0 ? <p className="admin-catalog-empty">Nenhuma opção encontrada.</p> : visibleOptions.map((option) => {
                  const usage = catalogOptionUsage(option);
                  return <div className={`admin-catalog-option ${option.active ? '' : 'inactive'}`} key={option.id}><div><strong>{option.name}</strong><small>{usage ? `Usada em ${usage} produto(s)` : 'Ainda não utilizada'}</small></div><div className="admin-catalog-actions"><button type="button" onClick={() => openOptionModal(type, null, option)} title={`Editar ${option.name}`} aria-label={`Editar ${option.name}`}><Pencil size={14}/></button><button type="button" onClick={() => toggleCatalogOption(option)} title={option.active ? `Desativar ${option.name}` : `Ativar ${option.name}`} aria-label={option.active ? `Desativar ${option.name}` : `Ativar ${option.name}`}><Power size={14}/><span>{option.active ? 'Desativar' : 'Ativar'}</span></button><button type="button" className="delete" onClick={() => deleteCatalogOption(option)} title={`Excluir ${option.name}`} aria-label={`Excluir ${option.name}`}><Trash2 size={14}/></button></div></div>;
                })}</div>
              </article>;
            })}</div>
          </section>}

          {adminSection === 'settings' && <section className="admin-panel admin-settings-panel">
            <div className="admin-settings-heading"><div><p className="admin-eyebrow">DADOS COMERCIAIS E LOGÍSTICA</p><h2><Settings size={21}/> Configurações da loja</h2><p>Atualize o contato, atacado e a estrutura usada no cálculo automático de frete.</p></div></div>
            <form className="admin-settings-form" onSubmit={handleSaveSettings}>
              <div className="admin-settings-grid"><label>Nome comercial<input value={storeNameDraft} onChange={(e) => setStoreNameDraft(e.target.value)} required/></label>
                <label><span className="admin-settings-label">WhatsApp <small>País + DDD + número</small></span><input inputMode="numeric" value={whatsappDraft} onChange={(e) => setWhatsappDraft(e.target.value.replace(/\D/g, '').slice(0,15))} placeholder="5562999999999" required/></label>
                <label>Quantidade mínima geral<input type="number" min="1" step="1" value={wholesaleMinimumDraft} onChange={(e) => setWholesaleMinimumDraft(e.target.value)} required/></label></div>
              <section className="admin-session-settings"><header><div><p className="admin-eyebrow">SEGURANÇA DO PAINEL</p><h3><LockKeyhole size={18}/> Sessão administrativa</h3><span>Após o encerramento, o administrador deverá informar e-mail e senha novamente.</span></div></header>
                <label>Encerrar após inatividade (minutos)<input type="number" min="5" max="480" step="1" value={sessionTimeoutDraft} onChange={(e) => setSessionTimeoutDraft(e.target.value)} required/><small>De 5 minutos a 8 horas. Fechar a aba ou o navegador também remove o acesso salvo.</small></label>
              </section>
              <section className="admin-shipping-settings"><header><div><p className="admin-eyebrow">FRETE AUTOMÁTICO</p><h3>Origem e valores padrão</h3><span>Estes dados serão usados somente quando um produto ainda não possuir peso e dimensões próprias.</span></div></header>
                <div className="admin-settings-grid shipping"><label>CEP de origem<input inputMode="numeric" maxLength="8" value={shippingDraft.originPostalCode} onChange={(e) => setShippingDraft((current) => ({...current,originPostalCode:e.target.value.replace(/\D/g,'').slice(0,8)}))} placeholder="Somente números"/></label>
                  <label>Peso padrão do produto (g)<input type="number" min="1" step="1" value={shippingDraft.weightGrams} onChange={(e) => setShippingDraft((current) => ({...current,weightGrams:e.target.value}))}/></label>
                  <label>Peso da embalagem (g)<input type="number" min="0" step="1" value={shippingDraft.packagingTareGrams} onChange={(e) => setShippingDraft((current) => ({...current,packagingTareGrams:e.target.value}))}/></label>
                  <label>Altura padrão (cm)<input type="number" min="1" step="0.1" value={shippingDraft.heightCm} onChange={(e) => setShippingDraft((current) => ({...current,heightCm:e.target.value}))}/></label>
                  <label>Largura padrão (cm)<input type="number" min="1" step="0.1" value={shippingDraft.widthCm} onChange={(e) => setShippingDraft((current) => ({...current,widthCm:e.target.value}))}/></label>
                  <label>Comprimento padrão (cm)<input type="number" min="1" step="0.1" value={shippingDraft.lengthCm} onChange={(e) => setShippingDraft((current) => ({...current,lengthCm:e.target.value}))}/></label>
                  <label>Máximo de vestidos/pacote<input type="number" min="1" step="1" value={shippingDraft.maxItems} onChange={(e) => setShippingDraft((current) => ({...current,maxItems:e.target.value}))}/></label>
                  <label>Prazo de preparação (dias)<input type="number" min="0" step="1" value={shippingDraft.handlingDays} onChange={(e) => setShippingDraft((current) => ({...current,handlingDays:e.target.value}))}/></label>
                  <label>Acréscimo no frete (%)<input type="number" min="0" step="0.01" value={shippingDraft.markup} onChange={(e) => setShippingDraft((current) => ({...current,markup:e.target.value}))}/></label></div>
                <section className="admin-sender-settings"><header><div><p className="admin-eyebrow">REMETENTE DA ETIQUETA</p><h3>Dados de postagem da loja</h3><span>Usados somente para gerar etiquetas. Preencha conforme o cadastro fiscal da loja.</span></div></header><div className="admin-settings-grid sender"><label>Nome completo / Razão social<input value={senderDraft.name} onChange={(e) => setSenderDraft((current) => ({...current,name:e.target.value}))}/></label><label>E-mail do remetente<input type="email" value={senderDraft.email} onChange={(e) => setSenderDraft((current) => ({...current,email:e.target.value}))}/></label><label>Telefone<input inputMode="numeric" value={senderDraft.phone} onChange={(e) => setSenderDraft((current) => ({...current,phone:e.target.value.replace(/\D/g,'').slice(0,15)}))} placeholder="DDD + número"/></label><label>CPF ou CNPJ<input inputMode="numeric" value={senderDraft.taxId} onChange={(e) => setSenderDraft((current) => ({...current,taxId:e.target.value.replace(/\D/g,'').slice(0,14)}))}/></label><label>Inscrição estadual<input value={senderDraft.stateRegister} onChange={(e) => setSenderDraft((current) => ({...current,stateRegister:e.target.value}))} placeholder="ISENTO, quando aplicável"/></label><label>Endereço<input value={senderDraft.address} onChange={(e) => setSenderDraft((current) => ({...current,address:e.target.value}))}/></label><label>Número<input value={senderDraft.number} onChange={(e) => setSenderDraft((current) => ({...current,number:e.target.value}))} placeholder="S/N, quando aplicável"/></label><label>Complemento<input value={senderDraft.complement} onChange={(e) => setSenderDraft((current) => ({...current,complement:e.target.value}))}/></label><label>Bairro / Setor<input value={senderDraft.district} onChange={(e) => setSenderDraft((current) => ({...current,district:e.target.value}))}/></label><label>Cidade<input value={senderDraft.city} onChange={(e) => setSenderDraft((current) => ({...current,city:e.target.value}))}/></label><label>Estado (UF)<input value={senderDraft.state} maxLength="2" onChange={(e) => setSenderDraft((current) => ({...current,state:e.target.value.replace(/[^a-z]/gi,'').toUpperCase().slice(0,2)}))} placeholder="GO"/></label></div></section>
                <div className="admin-shipping-providers"><label><input type="checkbox" checked={shippingDraft.melhorEnvioEnabled} onChange={(e) => setShippingDraft((current) => ({...current,melhorEnvioEnabled:e.target.checked}))}/><div><strong>Melhor Envio</strong><span>Correios, Jadlog e demais serviços habilitados na conta.</span></div><em>{melhorEnvioConnection.loading ? 'Verificando' : melhorEnvioConnection.connected ? 'Conectado' : shippingDraft.melhorEnvioEnabled ? 'Aguardando conexão' : 'Desativado'}</em></label>
                  <label><input type="checkbox" checked={shippingDraft.correiosEnabled} onChange={(e) => setShippingDraft((current) => ({...current,correiosEnabled:e.target.checked}))}/><div><strong>Correios direto</strong><span>Usará contrato e cartão de postagem próprios da loja.</span></div><em>{shippingDraft.correiosEnabled ? 'Preparado' : 'Desativado'}</em></label></div>
                <div className={`admin-shipping-connection ${melhorEnvioConnection.connected ? 'connected' : ''}`}><div><strong>{melhorEnvioConnection.connected ? 'Conta do Melhor Envio conectada' : 'Conecte sua conta do Melhor Envio'}</strong><span>{melhorEnvioConnection.connected ? `Autorização válida${melhorEnvioConnection.expiresAt ? ` até ${new Date(melhorEnvioConnection.expiresAt).toLocaleDateString('pt-BR')}` : ''}. A renovação será feita automaticamente.` : 'A autorização é necessária para consultar valores e prazos reais no checkout.'}</span></div><button type="button" className={melhorEnvioConnection.connected ? 'admin-secondary-button' : 'admin-primary-button'} onClick={melhorEnvioConnection.connected ? disconnectMelhorEnvio : connectMelhorEnvio} disabled={melhorEnvioConnection.loading}>{melhorEnvioConnection.loading ? 'Verificando...' : melhorEnvioConnection.connected ? 'Desconectar' : 'Conectar ao Melhor Envio'}</button></div>
              </section>
              <button type="submit" className="admin-primary-button admin-settings-save" disabled={settingsSaving}><Save size={17}/>{settingsSaving ? 'Salvando...' : 'Salvar configurações'}</button>
            </form>
            {settingsMessage && <p className={settingsMessage.includes('sucesso') ? 'admin-success-message' : 'admin-message'}>{settingsMessage}</p>}
          </section>}

          {adminSection === 'products' && <section className="admin-panel">
            <div className="admin-panel-heading"><div><p className="admin-eyebrow">CATÁLOGO</p><h2>Produtos e estoque</h2><p>Veja o estoque por cor, estampa e tamanho e edite cada vestido visualmente.</p></div></div>
            {dashboardLoading ? <div className="admin-inline-loading"><div className="admin-spinner"/><span>Atualizando dados...</span></div> : products.length === 0 ? <div className="admin-empty-state">Nenhum produto cadastrado.</div> : (
              <div className="admin-product-grid">{products.map((product) => {
                const stock = product.product_variants.reduce((sum, v) => sum + v.product_variant_stock.reduce((sub, item) => sub + item.stock, 0), 0);
                const price = product.promotional_price ?? product.price;
                return <article className="admin-product-card" key={product.id}>
                  <div className="admin-product-image-wrap">{product.image_url ? <img src={product.image_url} alt={product.name}/> : <div className="admin-no-image">Sem imagem</div>}<span className={`admin-status ${product.active ? 'active' : 'inactive'}`}>{product.active ? 'Ativo' : 'Inativo'}</span></div>
                  <div className="admin-product-body">
                    <div className="admin-product-title-row"><div><small>{product.category}</small><h3>{product.name}</h3></div><div>{product.show_in_promotions && <span className="admin-featured">Promoção</span>}{product.featured && <span className="admin-featured">Destaque</span>}</div></div>
                    <div className="admin-price-row"><div><span>Varejo</span><strong>{money(price)}</strong></div><div><span>Atacado</span><strong>{product.wholesale_rule_mode === 'disabled' ? '—' : money(product.wholesale_price)}</strong></div></div>
                    <div className="admin-rule-box"><span>Regra de atacado</span><strong>{wholesaleLabel(product, generalMinimum)}</strong></div>
                    <div className={`admin-logistics-status ${product.shipping_weight_grams ? 'complete' : 'fallback'}`}><span>Logística</span><strong>{product.shipping_weight_grams ? `${product.shipping_weight_grams} g · ${product.shipping_length_cm} × ${product.shipping_width_cm} × ${product.shipping_height_cm} cm` : 'Usando valores padrão da loja'}</strong></div>
                    <div className="admin-product-footer"><span>Estoque total</span><strong>{stock} peças</strong></div>
                    <button type="button" className="admin-edit-product-button" onClick={() => openEditProduct(product)}><Pencil size={16}/>Editar produto</button>
                  </div>
                </article>;
              })}</div>
            )}
          </section>}
          {sessionWarningSeconds !== null && <div className="admin-session-warning" role="dialog" aria-modal="true" aria-labelledby="session-warning-title"><div><LockKeyhole size={28}/><h2 id="session-warning-title">Sua sessão está terminando</h2><p>Por segurança, o painel será encerrado por inatividade em <strong>{Math.max(1, Math.ceil(sessionWarningSeconds / 60))} minuto(s)</strong>.</p><button type="button" className="admin-primary-button" onClick={continueAdminSession}>Continuar conectado</button></div></div>}
        </div>
      </div>

      {productFormOpen && <div className="admin-modal-backdrop admin-editor-backdrop" onClick={closeProductForm}>
        <section className="admin-modal admin-product-editor" onClick={(e) => e.stopPropagation()}>
          <div className="admin-editor-header">
            <div><p className="admin-eyebrow">{editingProductId ? 'EDITAR PRODUTO' : 'NOVO PRODUTO'}</p><h2>{productForm.name || (editingProductId ? 'Editar produto' : 'Novo produto')}</h2></div>
            <div className="admin-editor-header-actions">
              {editingProductId && <button type="button" className={productForm.active ? 'admin-deactivate-button' : 'admin-activate-button'} onClick={handleToggleProductActive} disabled={productSaving}>{productForm.active ? 'Desativar produto' : 'Ativar produto'}</button>}
              <button type="button" className="admin-icon-button" onClick={closeProductForm} disabled={productSaving}><X size={20}/></button>
            </div>
          </div>

          <div className="admin-editor-tabs">
            <button type="button" className={productTab === 'data' ? 'active' : ''} onClick={() => setProductTab('data')}>Dados do produto</button>
            <button type="button" className={productTab === 'images' ? 'active' : ''} onClick={() => setProductTab('images')}>Imagens e guia de medidas</button>
            <button type="button" className={productTab === 'variations' ? 'active' : ''} onClick={() => setProductTab('variations')}>Fotos e estoque por variação</button>
            <button type="button" className={productTab === 'highlight' ? 'active' : ''} onClick={() => setProductTab('highlight')}>Destaque</button>
          </div>

          <form className="admin-product-form" onSubmit={handleSaveProduct}>
            {productTab === 'data' && <div className="admin-tab-panel">
              <div className="admin-form-grid two">
                <label>Nome do produto<input value={productForm.name} onChange={(e) => updateProductField('name', e.target.value)} required/></label>
                <SelectWithAdd label="Categoria" value={productForm.category} onChange={(value) => updateProductField('category', value)} options={optionLists.categories} type="category" required/>
              </div>
              <label>Descrição<textarea rows="4" value={productForm.description} onChange={(e) => updateProductField('description', e.target.value)}/></label>
              <div className="admin-form-grid three">
                <label>Preço varejo<input type="text" inputMode="numeric" value={productForm.price} onChange={(e) => updateCurrencyField('price', e.target.value)} placeholder="R$ 0,00" required/></label>
                <label>Preço promocional<input type="text" inputMode="numeric" value={productForm.promotionalPrice} onChange={(e) => updateCurrencyField('promotionalPrice', e.target.value)} placeholder="R$ 0,00"/></label>
                <label>Preço atacado<input type="text" inputMode="numeric" value={productForm.wholesalePrice} onChange={(e) => updateCurrencyField('wholesalePrice', e.target.value)} placeholder="R$ 0,00" disabled={productForm.wholesaleRuleMode === 'disabled'}/></label>
              </div>
              <div className="admin-form-grid two">
                <label>Regra de atacado<select value={productForm.wholesaleRuleMode} onChange={(e) => updateProductField('wholesaleRuleMode', e.target.value)}><option value="inherit">Usar regra geral</option><option value="product">Regra específica deste produto</option><option value="disabled">Sem atacado</option></select></label>
                {productForm.wholesaleRuleMode === 'product' && <label>Mínimo específico<input type="number" min="1" value={productForm.wholesaleMinimumQuantity} onChange={(e) => updateProductField('wholesaleMinimumQuantity', e.target.value)}/></label>}
              </div>
              <section className="admin-product-logistics"><div><p className="admin-eyebrow">LOGÍSTICA</p><h3>Peso e dimensões deste produto</h3><p>Preencha os quatro campos para uma cotação precisa. Se todos ficarem vazios, serão usados os valores padrão da loja.</p></div><div className="admin-form-grid four"><label>Peso (g)<input type="number" min="1" step="1" value={productForm.shippingWeightGrams} onChange={(e) => updateProductField('shippingWeightGrams',e.target.value)}/></label><label>Altura (cm)<input type="number" min="1" step="0.1" value={productForm.shippingHeightCm} onChange={(e) => updateProductField('shippingHeightCm',e.target.value)}/></label><label>Largura (cm)<input type="number" min="1" step="0.1" value={productForm.shippingWidthCm} onChange={(e) => updateProductField('shippingWidthCm',e.target.value)}/></label><label>Comprimento (cm)<input type="number" min="1" step="0.1" value={productForm.shippingLengthCm} onChange={(e) => updateProductField('shippingLengthCm',e.target.value)}/></label></div></section>
            </div>}

            {productTab === 'images' && <div className="admin-tab-panel">
              <div className="admin-section-intro"><div><p className="admin-eyebrow">IMAGENS</p><h3>Imagem principal e guia de medidas</h3><p>A imagem principal é usada no catálogo. Se não escolher uma, a primeira foto de uma variação será usada automaticamente.</p></div></div>
              <div className="admin-form-grid two admin-image-grid">
                <SingleImageField label="Imagem principal do produto" value={productForm.imageUrl} target="main"/>
                <SingleImageField label="Imagem do guia de medidas" value={productForm.sizeGuideImageUrl} target="guide"/>
              </div>
            </div>}

            {productTab === 'variations' && <div className="admin-tab-panel">
              <div className="admin-variation-intro">
                <div><p className="admin-eyebrow">FOTOS E ESTOQUE</p><h3>Fotos e estoque por variação</h3><p>Envie todas as fotos do vestido. Depois, em cada cartão, informe cor, estampa e a quantidade disponível por tamanho.</p></div>
                <label className="admin-multi-upload"><Upload size={22}/><strong>Adicionar fotos do vestido</strong><span>Selecione várias fotos de uma vez</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => uploadDressPhotos(e.target.files)}/></label>
              </div>
              <div className="admin-tip-box"><strong>Dica:</strong> se uma mesma cor + estampa tiver várias fotos, use “Adicionar fotos” dentro do cartão daquela variação. O estoque pertence à variação, não à foto.</div>

              {productForm.variants.length === 0 ? <div className="admin-empty-variations"><ImagePlus size={34}/><strong>Nenhuma foto adicionada</strong><span>Comece enviando as fotos do vestido acima.</span></div> : (
                <div className="admin-visual-variant-grid">{productForm.variants.map((variant, index) => {
                  const variantStock = SIZE_LABELS.reduce((sum, size) => sum + (Number(variant.stock[size]) || 0), 0);
                  const cover = variant.primaryImageUrl || variant.images[0] || '';
                  return <article className="admin-visual-variant-card" key={variant.id ?? `new-${index}`}>
                    <div className="admin-visual-card-head"><span>Variação {index + 1}</span><button type="button" className="admin-danger-icon" onClick={() => removeVariant(index)} title="Remover variação"><Trash2 size={16}/></button></div>
                    <div className="admin-variation-cover">{cover ? <img src={cover} alt={`Variação ${index + 1}`}/> : <div><ImagePlus size={30}/><span>Sem foto</span></div>}</div>
                    <div className="admin-variation-gallery">{variant.images.map((url, imageIndex) => <div className={`admin-gallery-thumb ${url === variant.primaryImageUrl ? 'primary' : ''}`} key={`${url}-${imageIndex}`}>
                      <img src={url} alt="Foto da variação"/>
                      <button type="button" className="admin-thumb-primary" onClick={() => updateVariant(index, 'primaryImageUrl', url)}>{url === variant.primaryImageUrl ? 'Principal' : 'Tornar principal'}</button>
                      <button type="button" className="admin-thumb-remove" onClick={() => removeVariantImage(index, url)}><X size={13}/></button>
                    </div>)}</div>
                    <label className="admin-add-more-photos"><Plus size={15}/>Adicionar fotos<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => uploadVariantPhotos(e.target.files, index)}/></label>
                    <div className="admin-form-grid two">
                      <SelectWithAdd label="Cor" value={variant.color} onChange={(value) => updateVariant(index, 'color', value)} options={optionLists.colors} type="color" variantIndex={index} required/>
                      <SelectWithAdd label="Estampa" value={variant.printPattern} onChange={(value) => updateVariant(index, 'printPattern', value)} options={optionLists.prints} type="print" variantIndex={index} required/>
                    </div>
                    <div className="admin-stock-grid admin-stock-grid-visual">{SIZE_LABELS.map((size) => <label key={size}><span>{size}</span><input type="number" min="0" value={variant.stock[size]} onChange={(e) => updateVariantStock(index, size, e.target.value)}/></label>)}</div>
                    <div className="admin-variation-total">Estoque desta variação: <strong>{variantStock} peças</strong></div>
                  </article>;
                })}</div>
              )}
              <div className="admin-total-stock-bar"><span>Estoque total do produto</span><strong>{productTotalStock} peças</strong></div>
            </div>}

            {productTab === 'highlight' && <div className="admin-tab-panel">
              <div className="admin-section-intro"><div><p className="admin-eyebrow">PUBLICAÇÃO</p><h3>Destaque, promoções e disponibilidade</h3><p>Controle onde o produto aparece na loja.</p></div></div>
              <div className="admin-publish-options">
                <label><input type="checkbox" checked={productForm.active} onChange={(e) => updateProductField('active', e.target.checked)}/><div><strong>Produto ativo</strong><span>Quando desativado, não aparece para clientes.</span></div></label>
                <label><input type="checkbox" checked={productForm.featured} onChange={(e) => updateProductField('featured', e.target.checked)}/><div><strong>Produto em destaque</strong><span>Use para novidades, lançamentos e peças prioritárias.</span></div></label>
                <label><input type="checkbox" checked={productForm.showInPromotions} onChange={(e) => updateProductField('showInPromotions', e.target.checked)}/><div><strong>Exibir na aba Promoções</strong><span>Quando ativado, o produto aparece na seção de ofertas da loja.</span></div></label>
              </div>
            </div>}

            {productFormMessage && <p className="admin-message admin-form-message">{productFormMessage}</p>}
            <div className="admin-editor-footer">
              <div className="admin-editor-stock-summary"><span>Estoque total</span><strong>{productTotalStock} peças</strong></div>
              <div className="admin-form-actions"><button type="button" className="admin-secondary-button" onClick={closeProductForm} disabled={productSaving}>Cancelar</button><button type="submit" className="admin-primary-button" disabled={productSaving || Object.values(uploadingImages).some(Boolean)}><Save size={16}/>{productSaving ? 'Salvando...' : editingProductId ? 'Salvar alterações' : 'Cadastrar produto'}</button></div>
            </div>
          </form>
        </section>
      </div>}

      {optionModal && <div className="admin-option-modal-backdrop" onClick={closeOptionModal}><section className="admin-option-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-option-modal-head"><div><p className="admin-eyebrow">{optionModal.option ? 'EDITAR OPÇÃO' : 'NOVA OPÇÃO'}</p><h3>{optionModal.option ? 'Editar' : 'Adicionar'} {OPTION_LABELS[optionModal.type]}</h3></div><button type="button" className="admin-icon-button" onClick={closeOptionModal} disabled={optionSaving}><X size={18}/></button></div>
        <form onSubmit={handleSaveOption}><label>Nome da {OPTION_LABELS[optionModal.type]}<input autoFocus value={newOptionName} onChange={(e) => setNewOptionName(e.target.value)} placeholder={`Ex.: ${optionModal.type === 'category' ? 'Conjuntos' : optionModal.type === 'color' ? 'Verde Oliva' : 'Floral'}`} required/></label>{optionMessage && <p className="admin-message">{optionMessage}</p>}<div className="admin-form-actions"><button type="button" className="admin-secondary-button" onClick={closeOptionModal} disabled={optionSaving}>Cancelar</button><button type="submit" className="admin-primary-button" disabled={optionSaving}>{optionSaving ? 'Salvando...' : optionModal.option ? 'Salvar alteração' : 'Adicionar'}</button></div></form>
      </section></div>}
    </main>
  );
}

