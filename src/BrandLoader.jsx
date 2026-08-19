import React from 'react';
import logo from './assets/Logo.png';

export default function BrandLoader({ message = 'Carregando coleção...' }) {
  return <main className="brand-loader" role="status" aria-live="polite">
    <div className="brand-loader-mark" aria-hidden="true">
      <span className="brand-loader-ring"/>
      <span className="brand-loader-glow"/>
      <img src={logo} alt=""/>
    </div>
    <strong>CHIQUEHELITA</strong>
    <span className="brand-loader-message">{message}</span>
    <span className="brand-loader-dots" aria-hidden="true"><i/><i/><i/></span>
  </main>;
}
