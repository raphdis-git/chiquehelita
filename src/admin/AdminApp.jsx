import React, { useEffect, useState } from 'react';
import { LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';
import logo from '../assets/Logo.png';
import { supabase } from '../lib/supabase';
import './admin.css';

export default function AdminApp() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkSession();
    });

    return () => subscription.unsubscribe();
  }, []);

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
  }

  async function handleLogin(event) {
    event.preventDefault();
    setMessage('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

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
  }

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

        <button className="admin-logout-button" onClick={handleLogout}>
          <LogOut size={18} />
          Sair
        </button>
      </header>

      <section className="admin-welcome">
        <ShieldCheck size={32} />

        <div>
          <p className="admin-eyebrow">ACESSO PROTEGIDO</p>
          <h1>Painel Administrativo</h1>
          <p>
            Login realizado com sucesso. A próxima etapa será conectar produtos,
            estoque, preços, promoções e regras de atacado a este painel.
          </p>
        </div>
      </section>
    </main>
  );
}
