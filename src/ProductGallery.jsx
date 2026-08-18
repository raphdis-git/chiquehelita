import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Heart, X } from 'lucide-react';

export default function ProductGallery({ product, selectedVariantId, onSelectVariant }) {
  const gallery = useMemo(() => {
    const items = [];
    product.variants.forEach((variant) => {
      const images = variant.images?.length ? variant.images : (variant.image ? [variant.image] : []);
      images.forEach((url) => {
        if (!items.some((item) => item.url === url)) {
          items.push({ url, variantId: variant.id, color: variant.color, printPattern: variant.printPattern });
        }
      });
    });
    if (!items.length && product.image) items.push({ url: product.image, variantId: null, color: '', printPattern: '' });
    return items;
  }, [product]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    const selectedIndex = gallery.findIndex((item) => item.variantId === selectedVariantId);
    if (selectedIndex >= 0) setActiveIndex(selectedIndex);
    else if (activeIndex >= gallery.length) setActiveIndex(0);
  }, [selectedVariantId, gallery.length]);

  useEffect(() => {
    if (!lightboxOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setLightboxOpen(false);
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [lightboxOpen, activeIndex, gallery.length]);

  if (!gallery.length) {
    return <div className="product-image"><div className="product-placeholder">Sem imagem</div>{product.featured && <span className="badge">Destaque</span>}<button className="heart-button" aria-label="Favoritar"><Heart size={19}/></button></div>;
  }

  const active = gallery[activeIndex] ?? gallery[0];

  function choose(index) {
    const item = gallery[index];
    if (!item) return;
    setActiveIndex(index);
    if (item.variantId) onSelectVariant(item.variantId);
  }

  function move(delta) {
    choose((activeIndex + delta + gallery.length) % gallery.length);
  }

  return <div className="product-gallery">
    <div className="product-image">
      <button type="button" className="gallery-main-image-button" onClick={() => setLightboxOpen(true)} aria-label={`Ampliar foto de ${product.name}`}>
        <img src={active.url} alt={`${product.name}${active.color ? ` - ${active.color} ${active.printPattern}` : ''}`}/>
      </button>
      {product.featured && <span className="badge">Destaque</span>}
      <button className="heart-button" aria-label="Favoritar"><Heart size={19}/></button>
      {gallery.length > 1 && <>
        <button type="button" className="gallery-arrow previous" onClick={() => move(-1)} aria-label="Foto anterior"><ChevronLeft size={22}/></button>
        <button type="button" className="gallery-arrow next" onClick={() => move(1)} aria-label="Próxima foto"><ChevronRight size={22}/></button>
        <span className="gallery-counter">{activeIndex + 1} / {gallery.length}</span>
      </>}
    </div>
    {gallery.length > 1 && <div className="gallery-thumbnails" aria-label={`Fotos de ${product.name}`}>
      {gallery.map((item, index) => <button type="button" key={`${item.url}-${index}`} className={index === activeIndex ? 'selected' : ''} onClick={() => choose(index)} title={`${item.color}${item.printPattern ? ` · ${item.printPattern}` : ''}`}>
        <img src={item.url} alt={`${item.color} ${item.printPattern}`.trim() || product.name}/>
      </button>)}
    </div>}

    {lightboxOpen && <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label={`Foto ampliada de ${product.name}`} onClick={() => setLightboxOpen(false)}>
      <div className="gallery-lightbox-content" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="gallery-lightbox-close" onClick={() => setLightboxOpen(false)} aria-label="Fechar imagem ampliada"><X size={22}/></button>
        {gallery.length > 1 && <>
          <button type="button" className="gallery-lightbox-arrow previous" onClick={() => move(-1)} aria-label="Foto anterior"><ChevronLeft size={26}/></button>
          <button type="button" className="gallery-lightbox-arrow next" onClick={() => move(1)} aria-label="Próxima foto"><ChevronRight size={26}/></button>
        </>}
        <div className="gallery-lightbox-image-wrap">
          <img src={active.url} alt={`${product.name}${active.color ? ` - ${active.color} ${active.printPattern}` : ''}`}/>
        </div>
        <div className="gallery-lightbox-footer">
          <span>{active.color}{active.printPattern ? ` · ${active.printPattern}` : ''}</span>
          <strong>{activeIndex + 1} / {gallery.length}</strong>
        </div>
      </div>
    </div>}
  </div>;
}
