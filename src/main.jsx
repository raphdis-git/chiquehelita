import React from 'react';
import { createRoot } from 'react-dom/client';
import StoreApp from './StoreApp';
import AdminApp from './admin/AdminApp';
import './styles.css';

const isAdminRoute = /\/admin\/?$/.test(window.location.pathname);

createRoot(document.getElementById('root')).render(
  isAdminRoute ? <AdminApp /> : <StoreApp />,
);
