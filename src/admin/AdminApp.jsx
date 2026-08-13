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
} from 'lucide-react';
import logo from '../assets/Logo.png';
import { supabase } from '../lib/supabase';
import './admin.css';

function money(value) {
  return Number(value ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function wholesaleLabel(product, generalMinimum) {
  if (product.wholesale_rule_mode === 'disabled') return 'Sem atacado';
  if (product.wholesale_rule_mode === 'product') {
    return `Específica · ${product.wholesale_minimum_quantity} un.`;
  }
  return `Regra geral · ${generalMinimum} peças`;
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
            <label>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <label>
              Senha
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            {message && <p className="admin-message">{message}</p>}

            <button type="submit" className="admin-primary-button">
              Entrar no painel
            </button>
          </form>
        </section>
      </main>
    );
  }

  const generalMinimum = settings?.minimum_wholesale_quantity ?? 6;

  return (
    <main className="admin-dashboard">
      <header className="admin-dashboard-header">
        <div className="admin-brand">
          <img src={logo} alt="Chique Helita" />
          <div>
            <span>Administração</span>
            <strong>CHIQUEHELITA</strong>
          </div>
        </div>

        <div className="admin-header-actions">
          <button className="admin-ghost-button" onClick={loadDashboard} disabled={dashboardLoading}>
            <RefreshCw size={17} className={dashboardLoading ? 'admin-spin-icon' : ''} />
            Atualizar
          </button>
          <button className="admin-logout-button" onClick={handleLogout}>
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </header>

      <div className="admin-shell">
        <section className="admin-welcome">
          <ShieldCheck size={32} />
          <div>
            <p className="admin-eyebrow">ACESSO PROTEGIDO</p>
            <h1>Painel Administrativo</h1>
            <p>
              Produtos, estoque e regras comerciais agora já estão sendo lidos diretamente do Supabase.
            </p>
          </div>
        </section>

        <section className="admin-metrics" aria-label="Resumo da loja">
          <article><ShoppingBag size={22}/><span>Produtos cadastrados</span><strong>{metrics.totalProducts}</strong></article>
          <article><PackageCheck size={22}/><span>Produtos ativos</span><strong>{metrics.activeProducts}</strong></article>
          <article><Boxes size={22}/><span>Peças em estoque</span><strong>{metrics.totalStock}</strong></article>
          <article><CircleDollarSign size={22}/><span>Mínimo atacado geral</span><strong>{generalMinimum}</strong></article>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="admin-eyebrow">CATÁLOGO</p>
              <h2>Produtos e estoque</h2>
              <p>Esta é a primeira visão real do catálogo conectado ao banco de dados.</p>
            </div>
            <button className="admin-primary-button" type="button" disabled>
              + Novo produto
            </button>
          </div>

          {message && <p className="admin-message">{message}</p>}

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
                    <div className="admin-product-image-wrap">
                      {product.image_url ? <img src={product.image_url} alt={product.name}/> : <div className="admin-no-image">Sem imagem</div>}
                      <span className={`admin-status ${product.active ? 'active' : 'inactive'}`}>
                        {product.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <div className="admin-product-body">
                      <div className="admin-product-title-row">
                        <div><small>{product.category}</small><h3>{product.name}</h3></div>
                        {product.featured && <span className="admin-featured">Destaque</span>}
                      </div>

                      <div className="admin-price-row">
                        <div><span>Varejo</span><strong>{money(price)}</strong></div>
                        <div><span>Atacado</span><strong>{product.wholesale_rule_mode === 'disabled' ? '—' : money(product.wholesale_price)}</strong></div>
                      </div>

                      <div className="admin-rule-box">
                        <span>Regra de atacado</span>
                        <strong>{wholesaleLabel(product, generalMinimum)}</strong>
                      </div>

                      <div className="admin-size-list">
                        {product.product_sizes.map((size) => (
                          <div key={size.id}>
                            <span>{size.label}<small>{size.reference ? ` (${size.reference})` : ''}</small></span>
                            <strong>{size.stock}</strong>
                          </div>
                        ))}
                      </div>

                      <div className="admin-product-footer">
                        <span>Estoque total</span>
                        <strong>{stock} peças</strong>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
