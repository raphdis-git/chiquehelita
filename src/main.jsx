import React from 'react';
import { createRoot } from 'react-dom/client';
import StoreApp from './StoreApp';
import AdminApp from './admin/AdminApp';
import './styles.css';
import './launches-carousel.css';
import './gallery.css';
import './product-page.css';
import './search-menu.css';
import './checkout.css';
import './brand-loader.css';
import './anchor-navigation.css';

const isAdminRoute = /\/admin\/?$/.test(window.location.pathname);

createRoot(document.getElementById('root')).render(
  isAdminRoute ? <AdminApp /> : <StoreApp />,
);

