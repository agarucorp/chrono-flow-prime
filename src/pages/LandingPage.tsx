import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import heic2any from 'heic2any';

/** Pantallas hero (portrait). Los .HEIC se convierten a JPEG en el navegador (Chrome/Firefox); Safari puede mostrar HEIC nativo. */
const HERO_APP_SCREENSHOTS = [
  // Desktop mockups: mockup1 = IMG_9513 1, mockup2 = IMG_0903 1
  { src: '/galeria/IMG_9513%201.jpg', alt: 'App MALDA — otra pantalla' },
  { src: '/galeria/IMG_0903%201.jpg', alt: 'App MALDA — vista en el teléfono' },
] as const;

/** Poner en true para volver a mostrar el botón flotante de WhatsApp. */
const SHOW_LANDING_WHATSAPP_FAB = false;

function isHeicPath(url: string) {
  return /\.hei[cf]$/i.test(url);
}

/** Safari (iOS/macOS) suele mostrar HEIC en <img> sin conversión. */
function browserLikelySupportsHeicInImg(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (/Macintosh/i.test(ua) && /Safari/i.test(ua) && !/Chrom|Chromium|Edg/i.test(ua)) return true;
  return false;
}

async function heicBlobToJpegObjectUrl(blob: Blob): Promise<string> {
  const typed =
    blob.type && blob.type !== 'application/octet-stream'
      ? blob
      : new Blob([blob], { type: 'image/heic' });

  const converted = await heic2any({
    blob: typed,
    toType: 'image/jpeg',
    quality: 0.85,
  });

  const out = Array.isArray(converted) ? converted[0] : converted;
  return URL.createObjectURL(out);
}

/**
 * HEIC: Safari intenta URL directa; el resto usa heic2any (import dinámico).
 * JPG/WebP/PNG: src directo.
 */
function HeicOrStaticImg({
  src,
  alt,
  imgClassName,
  loading = 'lazy',
}: {
  src: string;
  alt: string;
  imgClassName?: string;
  loading?: 'eager' | 'lazy';
}) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(() =>
    isHeicPath(src) ? null : src
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const urlRef = { current: null as string | null };

    if (!isHeicPath(src)) {
      setDisplayUrl(src);
      setFailed(false);
      return () => {};
    }

    setDisplayUrl(null);
    setFailed(false);

    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const u = await heicBlobToJpegObjectUrl(blob);
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        urlRef.current = u;
        setDisplayUrl(u);
      } catch (e) {
        // Fallback: intentar mostrar HEIC directo (si el navegador lo soporta).
        console.error('[HEIC] conversión:', src, e);
        if (!cancelled) {
          setDisplayUrl(src);
          setFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, [src]);

  if (failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-md border border-red-400/60 bg-red-500/10 text-center text-xs text-red-100',
          imgClassName
        )}
      >
        Error HEIC
      </div>
    );
  }
  if (!displayUrl) {
    return (
      <div
        className={cn(
          'animate-pulse rounded-md border border-red-400/30 bg-red-950/30',
          imgClassName
        )}
        aria-hidden
      />
    );
  }

  return (
    <img
      src={displayUrl}
      alt={alt}
      className={imgClassName}
      loading={loading}
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

/** Chromium no decodifica HEIC en <img>; convertimos con heic2any (WASM). JPG/WebP/PNG se usan tal cual. */
function HeroScreenshotImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className={cn('absolute inset-0', className)}>
      <HeicOrStaticImg
        src={src}
        alt={alt}
        loading="eager"
        imgClassName="pointer-events-none absolute inset-0 z-10 h-full w-full select-none object-cover object-top"
      />
    </div>
  );
}

function useIsLg() {
  const [lg, setLg] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setLg(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return lg;
}

type GalleryItem =
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'video'; src: string; alt: string };

const GALLERY_FOLDER_IMAGES: { src: string; alt: string }[] = [
  // Galería: usar JPG para evitar problemas de render (nombres originales con espacio + 1).
  { src: '/galeria/IMG_0806%201.jpg', alt: 'MALDA — espacio de entrenamiento' },
  { src: '/galeria/IMG_0831%201.jpg', alt: 'MALDA — instalaciones' },
  { src: '/galeria/IMG_9465%201.jpg', alt: 'MALDA — entrenamiento' },
  { src: '/galeria/IMG_9511%201.jpg', alt: 'MALDA — ambiente' },
];

const GALLERY_VIDEO: GalleryItem = {
  kind: 'video',
  src: '/galeria/video.MOV',
  alt: 'Video MALDA',
};

function buildGalleryDesktop(): GalleryItem[] {
  // Desktop: sin video (solo imágenes).
  return [...GALLERY_FOLDER_IMAGES.map((i) => ({ kind: 'image' as const, ...i }))];
}

function buildGalleryMobile(): GalleryItem[] {
  return [
    ...GALLERY_FOLDER_IMAGES.map((i) => ({ kind: 'image' as const, ...i })),
    // Mobile gallery: todo excepto IMG_9513 1 (la del hero móvil).
    { kind: 'image', src: '/galeria/IMG_0903%201.jpg', alt: 'MALDA — espacio' },
  ];
}

function GallerySlide({ item }: { item: GalleryItem }) {
  if (item.kind === 'video') {
    return (
      <div className="relative aspect-video w-full max-h-[min(70vh,520px)] overflow-hidden rounded-xl border border-white/10 bg-black">
        <video
          className="h-full w-full object-cover"
          controls
          playsInline
          preload="metadata"
          aria-label={item.alt}
        >
          <source src={item.src} type="video/quicktime" />
          <source src={item.src} />
        </video>
      </div>
    );
  }
  return (
    // Fijamos altura para que el placeholder no se estire y ocupe toda la pantalla en desktop.
    <div className="relative h-[260px] sm:h-[300px] md:h-[340px] lg:h-[360px] w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
      <HeicOrStaticImg
        src={item.src}
        alt={item.alt}
        loading="eager"
        // Evita el "zoom" de `object-cover` que puede hacer que se vea desenfocado cuando el aspect ratio cambia.
        imgClassName="absolute inset-0 h-full w-full object-contain object-top"
      />
    </div>
  );
}

function HeroDeviceMockup({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative w-[42vw] max-w-[200px] sm:w-[220px] sm:max-w-none lg:w-[248px]',
        className
      )}
    >
      <div className="w-full rounded-[2.5rem] bg-gradient-to-b from-zinc-500 via-zinc-800 to-zinc-950 p-[3px] shadow-[0_28px_56px_-12px_rgba(0,0,0,0.92),0_0_40px_rgba(255,255,255,0.04)] ring-1 ring-white/[0.07]">
        <div className="w-full rounded-[2.35rem] bg-gray-900 p-2.5">
          <div className="relative isolate aspect-[10/19.2] w-full overflow-hidden rounded-[1.35rem] bg-gray-900 ring-1 ring-white/[0.08]">
            <HeroScreenshotImage src={src} alt={alt} />
          </div>
        </div>
      </div>
    </div>
  );
}

const LandingPage = () => {
  const navigate = useNavigate();
  /** Solo mobile: alterna qué columna del cuadro «¿Por qué MALDA?» se muestra */
  const [porQueMaldaVista, setPorQueMaldaVista] = useState<'propuesta' | 'diferencia'>('propuesta');
  const isLg = useIsLg();
  const galleryItems = isLg ? buildGalleryDesktop() : buildGalleryMobile();

  const scrollToSection = (targetId: string) => {
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    scrollToSection(targetId);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/[0.62] backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-[calc(3.5rem*1.15)] items-center justify-between sm:h-16">
            {/* Logo — cabe dentro de la navbar en mobile/desktop */}
            <div className="flex min-w-0 items-center py-2">
              <img
                src="/assets/malda.svg"
                alt="MALDA Logo"
                className="h-8 w-auto max-h-9 object-contain object-left sm:h-9 sm:max-h-10 lg:h-10"
              />
            </div>

            {/* Navegación Desktop - Centrada */}
            <nav className="hidden md:flex items-center gap-12 absolute left-1/2 transform -translate-x-1/2">
              <a 
                href="#como-funciona" 
                onClick={(e) => handleSmoothScroll(e, 'como-funciona')}
                className="text-white hover:text-gray-300 transition-colors text-sm font-light"
              >
                ¿Cómo funciona?
              </a>
              <a 
                href="#planes" 
                onClick={(e) => handleSmoothScroll(e, 'planes')}
                className="text-white hover:text-gray-300 transition-colors text-sm font-light"
              >
                Planes
              </a>
              <a 
                href="#app" 
                onClick={(e) => handleSmoothScroll(e, 'app')}
                className="text-white hover:text-gray-300 transition-colors text-sm font-light"
              >
                App
              </a>
            </nav>

            {/* Botones de acción */}
            <div className="flex items-center gap-4">
              {/* Instagram */}
              <a
                href="https://instagram.com/maldagym"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-gray-300 transition-colors"
                aria-label="Seguinos en Instagram"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              {/* Botón Iniciar sesión */}
              <Button
                onClick={() => navigate('/login')}
                className="bg-white text-black hover:bg-gray-100 rounded-lg px-5 py-2 text-sm font-medium transition-all duration-200 shadow-sm"
              >
                Iniciar sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-black">
        {/* Mobile: imagen ampliada (~156% = 130% × 1.2); texto y CTAs en overlay */}
        <div className="relative lg:hidden max-lg:overflow-x-hidden">
          <div className="w-full overflow-hidden">
            <img
              src="/galeria/IMG_9513%201.jpg"
              alt="MALDA"
              className="relative left-1/2 block h-auto w-[156%] max-w-none -translate-x-1/2 object-top grayscale brightness-[0.82]"
              loading="eager"
              decoding="async"
              draggable={false}
            />
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[1] bg-black/18 bg-gradient-to-b from-black/20 via-black/10 to-black/35"
          />
          <div className="absolute inset-0 z-10 flex flex-col justify-center gap-6 px-4 pb-12 pt-20 sm:px-6 sm:pb-14">
            <h1 className="text-[47px] font-bold leading-[1.1] tracking-tight drop-shadow-md" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Entrenamiento
              <br />
              <span className="text-[53px]">100%</span>
              <br />
              <span className="text-[47px]">personalizado.</span>
              <br />
              <span className="text-[47px]">Sin vueltas.</span>
            </h1>
            <p className="text-[16px] text-gray-200 max-w-2xl py-3 leading-relaxed drop-shadow-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
              MALDA no es un gimnasio convencional ni una clase grupal. Es un espacio de entrenamiento personalizado donde tenés tu propio circuito, un cupo reservado y seguimiento directo.
            </p>
            <div className="flex flex-col gap-6">
              <Button
                onClick={() => scrollToSection('planes')}
                className="bg-white text-black hover:bg-gray-100 rounded-lg px-8 py-3 text-base font-medium transition-all duration-200 shadow-sm"
              >
                Ver planes
              </Button>
              <Button
                onClick={() => navigate('/login')}
                className="bg-gray-800 text-white border border-gray-700 hover:bg-gray-700 rounded-lg px-8 py-3 text-base font-medium transition-all duration-200"
              >
                Ya soy alumno
              </Button>
            </div>
          </div>
        </div>

        {/* Desktop: igual que antes (fondo + overlay + grid + mockups) */}
        <div className="relative hidden items-center overflow-visible px-4 pt-28 pb-14 sm:px-6 sm:pt-32 sm:pb-20 lg:flex lg:px-8 lg:pt-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat grayscale brightness-[0.62]"
            style={{ backgroundImage: "url('/Hero/hero.jpg')" }}
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] bg-black/35" />
          <div className="relative z-10 mx-auto grid w-full min-w-0 max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(580px,1fr)] lg:gap-14 xl:gap-20">
            <div className="text-left relative z-0 min-w-0">
              <h1 className="text-[37px] sm:text-[43px] md:text-[55px] lg:text-[67px] font-bold mb-6 leading-[1.1] tracking-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Entrenamiento
                <br />
                <span className="text-[43px] sm:text-[55px] md:text-[67px] lg:text-[79px]">100%</span>
                <br />
                <span className="text-[37px] sm:text-[43px] md:text-[55px] lg:text-[67px]">personalizado.</span>
                <br />
                <span className="text-[37px] sm:text-[43px] md:text-[55px] lg:text-[67px]">Sin vueltas.</span>
              </h1>
              <p className="text-[12px] sm:text-[14px] text-gray-300 max-w-2xl mb-10 leading-relaxed mt-8" style={{ fontFamily: 'Poppins, sans-serif' }}>
                MALDA no es un gimnasio convencional ni una clase grupal. Es un espacio de entrenamiento personalizado donde tenés tu propio circuito, un cupo reservado y seguimiento directo.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 mt-10">
                <Button
                  onClick={() => scrollToSection('planes')}
                  className="bg-white text-black hover:bg-gray-100 rounded-lg px-8 py-3 text-base font-medium transition-all duration-200 shadow-sm"
                >
                  Ver planes
                </Button>
                <Button
                  onClick={() => navigate('/login')}
                  className="bg-gray-800 text-white border border-gray-700 hover:bg-gray-700 rounded-lg px-8 py-3 text-base font-medium transition-all duration-200"
                >
                  Ya soy alumno
                </Button>
              </div>
            </div>
            <div className="relative z-10 hidden min-w-[580px] justify-center overflow-visible lg:flex">
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[640px] max-h-[90vh] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.09),transparent_62%)] blur-3xl"
                aria-hidden
              />
              <div className="relative flex min-w-max flex-row flex-nowrap items-center justify-center gap-3 sm:gap-7 lg:gap-8">
                <HeroDeviceMockup
                  src={HERO_APP_SCREENSHOTS[0].src}
                  alt={HERO_APP_SCREENSHOTS[0].alt}
                  className="shrink-0 sm:-rotate-[4deg] z-10"
                />
                <HeroDeviceMockup
                  src={HERO_APP_SCREENSHOTS[1].src}
                  alt={HERO_APP_SCREENSHOTS[1].alt}
                  className="shrink-0 sm:rotate-[4deg] z-20"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mockup solo mobile: mismo fondo que sección "Un modelo de entrenamiento…" (bg-gray-900) */}
      <div className="flex justify-center bg-gray-900 px-4 py-8 sm:px-6 lg:hidden">
        <div className="relative w-full max-w-[280px]">
          <div className="w-full rounded-[2.5rem] bg-gradient-to-b from-zinc-500 via-zinc-800 to-zinc-950 p-[3px] shadow-[0_28px_56px_-12px_rgba(0,0,0,0.92),0_0_40px_rgba(255,255,255,0.04)] ring-1 ring-white/[0.07]">
            <div className="w-full rounded-[2.35rem] bg-gray-900 p-2.5">
              <div className="relative aspect-[10/19.2] w-full overflow-hidden rounded-[1.35rem] bg-gray-900 ring-1 ring-white/[0.08]">
                <img
                  src="/galeria/IMG_0903%201.jpg"
                  alt="App MALDA"
                  className="absolute inset-0 h-full w-full object-cover object-top select-none"
                  loading="eager"
                  decoding="async"
                  draggable={false}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sección de Características */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-900" id="como-funciona">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-[26px] sm:text-[32px] md:text-[44px] font-bold mb-6">
              Un modelo de entrenamiento diseñado para rendir
            </h2>
            <p className="text-[14px] sm:text-[16px] text-gray-400 max-w-3xl mx-auto leading-relaxed">
              En MALDA no pagás una cuota para "venir cuando quieras" - Pagás por un espacio garantizado, un plan profesional y una dinámica de trabajo eficiente.
            </p>
          </div>

          {/* Tarjetas de características */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            {/* Tarjeta 1 */}
            <div className="group border border-white/50 rounded-xl p-8 bg-black transition-all duration-300 ease-out hover:bg-white hover:border-white hover:shadow-xl hover:shadow-black/25">
              <h3 className="text-xl font-bold mb-4 text-white transition-colors duration-300 group-hover:text-black">Tu lugar reservado</h3>
              <p className="text-gray-300 text-sm leading-relaxed transition-colors duration-300 group-hover:text-gray-700">
                El caos de los gimnasios llenos ya no existe. Al inscribirte, elegís tus horarios fijos por mes. Ese cupo es tuyo y de nadie más. Esto nos permite asegurar que siempre tengas el espacio y el equipamiento necesario para completar tu sesión sin esperas.
              </p>
            </div>

            {/* Tarjeta 2 */}
            <div className="group border border-white/50 rounded-xl p-8 bg-black transition-all duration-300 ease-out hover:bg-white hover:border-white hover:shadow-xl hover:shadow-black/25">
              <h3 className="text-xl font-bold mb-4 text-white transition-colors duration-300 group-hover:text-black">Tu propio circuito</h3>
              <p className="text-gray-300 text-sm leading-relaxed transition-colors duration-300 group-hover:text-gray-700">
                No damos clases grupales ni rutinas genéricas. Al llegar, el coach te asigna tu trabajo del día basado en tus objetivos y nivel. Aunque compartas la hora con otros alumnos, tu entrenamiento es individual. Entrenás a tu ritmo, con la técnica bajo supervisión constante.
              </p>
            </div>

            {/* Tarjeta 3 */}
            <div className="group border border-white/50 rounded-xl p-8 bg-black transition-all duration-300 ease-out hover:bg-white hover:border-white hover:shadow-xl hover:shadow-black/25">
              <h3 className="text-xl font-bold mb-4 text-white transition-colors duration-300 group-hover:text-black">Pagás lo que entrenás</h3>
              <p className="text-gray-300 text-sm leading-relaxed transition-colors duration-300 group-hover:text-gray-700">
                Nuestro sistema de pagos premia la constancia. Si por algún motivo tenés que cancelar una clase, lo hacés desde la App. Ese crédito no se pierde y se computa automáticamente como un descuento para tu cuota del mes siguiente. El sistema gestiona tu saldo con transparencia total.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sección Comparativa */}
      <section className="px-4 pt-14 pb-20 sm:px-6 md:py-20 lg:px-8 bg-[#F5F5DC] relative overflow-hidden">
        {/* Elementos decorativos de fondo */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-[26px] sm:text-[32px] md:text-[40px] font-bold mb-4 text-black">
              ¿Por qué MALDA?
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-transparent via-black/30 to-transparent mx-auto"></div>
          </div>
          
          {/* Tabla Comparativa Mejorada */}
          <div className="relative">
            {/* Contenedor principal con efecto vidrioso */}
            <div className="rounded-2xl border border-white/20 bg-gray-800/90 p-5 shadow-2xl backdrop-blur-xl sm:p-10 md:p-12">
              {/* Mobile: mismos conceptos que los títulos de columna, como botones conmutadores */}
              <div
                className="mb-6 grid grid-cols-2 gap-2 rounded-full bg-white/10 p-1 md:hidden"
                role="tablist"
                aria-label="Vista del cuadro comparativo"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={porQueMaldaVista === 'propuesta'}
                  onClick={() => setPorQueMaldaVista('propuesta')}
                  className={cn(
                    'rounded-full px-2 py-2.5 text-center text-[11px] font-semibold leading-tight transition-colors sm:text-xs',
                    porQueMaldaVista === 'propuesta'
                      ? 'bg-white text-black shadow-sm'
                      : 'text-gray-300 hover:text-white'
                  )}
                >
                  Nuestra propuesta
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={porQueMaldaVista === 'diferencia'}
                  onClick={() => setPorQueMaldaVista('diferencia')}
                  className={cn(
                    'rounded-full px-2 py-2.5 text-center text-[11px] font-semibold leading-tight transition-colors sm:text-xs',
                    porQueMaldaVista === 'diferencia'
                      ? 'bg-white text-black shadow-sm'
                      : 'text-gray-300 hover:text-white'
                  )}
                >
                  Diferencia con el resto
                </button>
              </div>

              {/* Desktop: encabezados de columnas (igual que antes) */}
              <div className="relative mb-10 hidden grid-cols-2 gap-16 border-b border-white/20 pb-6 md:grid">
                <div className="relative">
                  <div className="absolute -left-4 top-0 bottom-0 w-1 rounded-full bg-gradient-to-b from-white/30 to-transparent"></div>
                  <h3 className="text-lg font-bold uppercase tracking-wider text-white sm:text-xl">MALDA ES...</h3>
                  <div className="mt-2 text-[10px] uppercase tracking-widest text-gray-400">Nuestra propuesta</div>
                </div>
                <div className="relative">
                  <div className="absolute -left-4 top-0 bottom-0 w-1 rounded-full bg-gradient-to-b from-white/30 to-transparent"></div>
                  <h3 className="text-lg font-bold uppercase tracking-wider text-white sm:text-xl">DIFERENCIA CON EL RESTO</h3>
                  <div className="mt-2 text-[10px] uppercase tracking-widest text-gray-400">Lo que nos distingue</div>
                </div>
              </div>

              <div className="space-y-7 md:space-y-8">
                {/* Fila 1 */}
                <div className="group relative">
                  <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 md:gap-16">
                    <div
                      className={cn(
                        'relative',
                        porQueMaldaVista === 'diferencia' && 'hidden md:block'
                      )}
                    >
                      <h4 className="mb-2 text-lg font-bold leading-tight text-white sm:text-xl">
                        Entrenamiento personalizado
                      </h4>
                      <div className="h-0.5 w-16 bg-gradient-to-r from-white/40 to-transparent"></div>
                    </div>
                    <div
                      className={cn(
                        'relative',
                        porQueMaldaVista === 'propuesta' && 'hidden md:block'
                      )}
                    >
                      <div className="absolute left-0 top-2 h-2 w-2 rounded-full bg-white/40 transition-all duration-300 group-hover:bg-white/60"></div>
                      <p className="pl-4 text-sm font-light leading-relaxed text-gray-300 sm:text-base">
                        Tu plan es único. No seguimos coreografías ni rutinas genéricas.
                      </p>
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                </div>

                {/* Fila 2 */}
                <div className="group relative">
                  <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 md:gap-16">
                    <div className={cn('relative', porQueMaldaVista === 'diferencia' && 'hidden md:block')}>
                      <h4 className="mb-2 text-lg font-bold leading-tight text-white sm:text-xl">Cupos limitados</h4>
                      <div className="h-0.5 w-16 bg-gradient-to-r from-white/40 to-transparent"></div>
                    </div>
                    <div className={cn('relative', porQueMaldaVista === 'propuesta' && 'hidden md:block')}>
                      <div className="absolute left-0 top-2 h-2 w-2 rounded-full bg-white/40 transition-all duration-300 group-hover:bg-white/60"></div>
                      <p className="pl-4 text-sm font-light leading-relaxed text-gray-300 sm:text-base">
                        Entrenás con espacio y equipo siempre disponible. Sin amontonamientos.
                      </p>
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                </div>

                {/* Fila 3 */}
                <div className="group relative">
                  <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 md:gap-16">
                    <div className={cn('relative', porQueMaldaVista === 'diferencia' && 'hidden md:block')}>
                      <h4 className="mb-2 text-lg font-bold leading-tight text-white sm:text-xl">Autogestión de turnos</h4>
                      <div className="h-0.5 w-16 bg-gradient-to-r from-white/40 to-transparent"></div>
                    </div>
                    <div className={cn('relative', porQueMaldaVista === 'propuesta' && 'hidden md:block')}>
                      <div className="absolute left-0 top-2 h-2 w-2 rounded-full bg-white/40 transition-all duration-300 group-hover:bg-white/60"></div>
                      <p className="pl-4 text-sm font-light leading-relaxed text-gray-300 sm:text-base">
                        Cancelás y reprogramás desde la App. Tu saldo se ajusta solo.
                      </p>
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                </div>

                {/* Fila 4 */}
                <div className="group relative">
                  <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 md:gap-16">
                    <div className={cn('relative', porQueMaldaVista === 'diferencia' && 'hidden md:block')}>
                      <h4 className="mb-2 text-lg font-bold leading-tight text-white sm:text-xl">Atención directa</h4>
                      <div className="h-0.5 w-16 bg-gradient-to-r from-white/40 to-transparent"></div>
                    </div>
                    <div className={cn('relative', porQueMaldaVista === 'propuesta' && 'hidden md:block')}>
                      <div className="absolute left-0 top-2 h-2 w-2 rounded-full bg-white/40 transition-all duration-300 group-hover:bg-white/60"></div>
                      <p className="pl-4 text-sm font-light leading-relaxed text-gray-300 sm:text-base">
                        El canal de WhatsApp es para consultas específicas; la agenda la controlás vos.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Sombra decorativa inferior */}
            <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-3/4 h-4 bg-black/10 blur-xl rounded-full"></div>
          </div>
        </div>
      </section>

      {/* Sección de Planes */}
      <section id="planes" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-900 relative overflow-hidden">
        {/* Elementos decorativos de fondo */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 right-20 w-64 h-64 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 left-20 w-80 h-80 bg-white rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          {/* Header de la sección */}
          <div className="text-center mb-16">
            <h2 className="text-[26px] sm:text-[32px] md:text-[44px] font-bold mb-6">
              Planes de Entrenamiento
            </h2>
            <p className="text-[14px] sm:text-[16px] text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Los planes de pago son de acuerdo a la cantidad de días que asistas. Al abonar la mensualidad, estás reservando un cupo para tus horarios elegidos.
            </p>
            <div className="w-24 h-1 bg-gradient-to-r from-transparent via-white to-transparent mx-auto mt-6"></div>
          </div>

          {/* Grid de Planes: una columna en mobile/tablet; 5 columnas desde lg */}
          <div className="mx-auto mt-10 grid max-w-md grid-cols-1 gap-4 sm:mt-12 sm:max-w-none sm:gap-5 lg:grid-cols-5 lg:gap-6">
            {/* Plan 1 día */}
            <div className="group relative rounded-2xl border border-white/10 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-white/30 hover:shadow-2xl max-lg:from-zinc-800 max-lg:via-zinc-800 max-lg:to-zinc-900 max-lg:border-white/15 max-lg:shadow-md max-lg:shadow-black/30 sm:p-6 max-lg:touch-manipulation">
              <div className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-white/10 transition-all duration-300">
                <span className="text-lg font-bold text-white">1</span>
              </div>
              <div className="mt-8 mb-4">
                <h3 className="text-xl font-bold text-white mb-2">1 Día</h3>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Por semana</p>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold text-white">$12.500</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">por clase</p>
              </div>
              <div className="pt-4 border-t border-white/10">
                <p className="text-sm text-gray-300 leading-relaxed">
                  Ideal para comenzar tu camino en el fitness
                </p>
              </div>
            </div>

            {/* Plan 2 días */}
            <div className="group relative rounded-2xl border border-white/10 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-white/30 hover:shadow-2xl max-lg:from-zinc-800 max-lg:via-zinc-800 max-lg:to-zinc-900 max-lg:border-white/15 max-lg:shadow-md max-lg:shadow-black/30 sm:p-6 max-lg:touch-manipulation">
              <div className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-white/10 transition-all duration-300">
                <span className="text-lg font-bold text-white">2</span>
              </div>
              <div className="mt-8 mb-4">
                <h3 className="text-xl font-bold text-white mb-2">2 Días</h3>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Por semana</p>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold text-white">$11.250</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">por clase</p>
              </div>
              <div className="pt-4 border-t border-white/10">
                <p className="text-sm text-gray-300 leading-relaxed">
                  Perfecto para mantenerte activo y constante
                </p>
              </div>
            </div>

            {/* Plan 3 días - Destacado (sin scale en mobile para evitar overflow) */}
            <div className="group relative rounded-2xl border-2 border-white/30 bg-gradient-to-br from-white/5 via-white/10 to-white/5 p-5 transition-all duration-300 hover:-translate-y-2 hover:border-white/50 hover:shadow-2xl max-lg:from-zinc-800 max-lg:via-zinc-700 max-lg:to-zinc-800 max-lg:shadow-md max-lg:shadow-black/30 sm:p-6 lg:scale-105 max-lg:touch-manipulation">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-white text-black text-xs font-bold px-3 py-1 rounded-full">Más Popular</span>
              </div>
              <div className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/40 group-hover:bg-white/30 transition-all duration-300">
                <span className="text-lg font-bold text-white">3</span>
              </div>
              <div className="mt-8 mb-4">
                <h3 className="text-xl font-bold text-white mb-2">3 Días</h3>
                <p className="text-xs text-gray-400 uppercase tracking-widest mb-4">Por semana</p>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold text-white">$10.000</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">por clase</p>
              </div>
              <div className="pt-4 border-t border-white/20">
                <p className="text-sm text-gray-300 leading-relaxed">
                  Construí hábitos sólidos de entrenamiento
                </p>
              </div>
            </div>

            {/* Plan 4 días */}
            <div className="group relative rounded-2xl border border-white/10 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-white/30 hover:shadow-2xl max-lg:from-zinc-800 max-lg:via-zinc-800 max-lg:to-zinc-900 max-lg:border-white/15 max-lg:shadow-md max-lg:shadow-black/30 sm:p-6 max-lg:touch-manipulation">
              <div className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-white/10 transition-all duration-300">
                <span className="text-lg font-bold text-white">4</span>
              </div>
              <div className="mt-8 mb-4">
                <h3 className="text-xl font-bold text-white mb-2">4 Días</h3>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Por semana</p>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold text-white">$8.750</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">por clase</p>
              </div>
              <div className="pt-4 border-t border-white/10">
                <p className="text-sm text-gray-300 leading-relaxed">
                  Para entrenamiento avanzado y resultados rápidos
                </p>
              </div>
            </div>

            {/* Plan 5 días */}
            <div className="group relative rounded-2xl border border-white/10 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-white/30 hover:shadow-2xl max-lg:from-zinc-800 max-lg:via-zinc-800 max-lg:to-zinc-900 max-lg:border-white/15 max-lg:shadow-md max-lg:shadow-black/30 sm:p-6 max-lg:touch-manipulation">
              <div className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-white/10 transition-all duration-300">
                <span className="text-lg font-bold text-white">5</span>
              </div>
              <div className="mt-8 mb-4">
                <h3 className="text-xl font-bold text-white mb-2">5 Días</h3>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Por semana</p>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold text-white">$7.500</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">por clase</p>
              </div>
              <div className="pt-4 border-t border-white/10">
                <p className="text-sm text-gray-300 leading-relaxed">
                  Máximo rendimiento y dedicación total
                </p>
              </div>
            </div>
          </div>

          {/* CTA Final */}
          <div className="text-center mt-16">
            <Button
              onClick={() => navigate('/login')}
              className="bg-white text-black hover:bg-gray-100 rounded-lg px-8 py-3 text-base font-medium transition-all duration-200 shadow-lg"
            >
              Elegir mi plan
            </Button>
          </div>
        </div>
      </section>

      {/* Sección App */}
      <section id="app" className="px-4 pt-14 pb-20 sm:px-6 md:py-20 lg:px-8 bg-[#F5F5DC] relative overflow-hidden">
        {/* Elementos decorativos de fondo */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 right-10 w-72 h-72 bg-black rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-10 w-96 h-96 bg-black rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          {/* Header de la sección */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-black/5 border-2 border-black/20">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-black">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
              </svg>
              <span className="text-sm text-black/70 uppercase tracking-wider">Aplicacion web</span>
            </div>
            <h2 className="text-[26px] sm:text-[32px] md:text-[44px] font-bold mb-6 text-black">
              Tu panel de gestión
            </h2>
            <p className="text-[14px] sm:text-[16px] text-black/70 max-w-3xl mx-auto leading-relaxed">
              Sistema de autogestión completo para que controles tus clases desde cualquier lugar, en cualquier momento
            </p>
            <div className="w-24 h-1 bg-gradient-to-r from-transparent via-black/30 to-transparent mx-auto mt-6"></div>
          </div>

          {/* Sección principal con capturas móviles */}
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-stretch mb-20">
            {/* Columna izquierda: Mis clases */}
            <div className="order-2 flex min-h-0 lg:order-1">
              <div className="flex h-full min-h-0 w-full flex-col rounded-3xl border-2 border-black/20 bg-white p-8 shadow-xl">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-black/20 bg-black/5">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6 text-black">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-black">Mis clases</h3>
                    <p className="text-sm text-black/60">Gestioná tus horarios recurrentes</p>
                  </div>
                </div>
                <p className="mb-6 text-sm leading-relaxed text-black/80">
                  Configurá tus horarios recurrentes de forma fácil. Una vez seleccionados, quedan reservados para vos cada semana. Podés visualizar todas tus clases programadas, cancelarlas cuando lo necesites y reprogramar sin complicaciones.
                </p>
                {/* Mockup: caja fija = proporción intrínseca de horariomobile.jpeg (1080×1048); Balance encaja entero con contain */}
                <div className="relative mx-auto mt-auto w-full max-w-[280px] shrink-0">
                  <div className="relative rounded-[2.5rem] border-4 border-gray-800 bg-black p-2 shadow-2xl">
                    <div className="relative w-full overflow-hidden rounded-[2rem] bg-black aspect-[1080/1048]">
                      <img
                        src="/tutorial/horariomobile.jpeg"
                        alt="Vista móvil de Mis clases"
                        className="absolute inset-0 h-full w-full object-contain object-top"
                      />
                    </div>
                  </div>
                  <div className="pointer-events-none absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-white/5 to-transparent" />
                </div>
              </div>
            </div>

            {/* Columna derecha: Balance */}
            <div className="order-1 flex min-h-0 lg:order-2">
              <div className="flex h-full min-h-0 w-full flex-col rounded-3xl border-2 border-black/20 bg-white p-8 shadow-xl">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-black/20 bg-black/5">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6 text-black">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm0 0h.008v.008H18V10.5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-black">Balance y pagos</h3>
                    <p className="text-sm text-black/60">Controlá tus finanzas</p>
                  </div>
                </div>
                <p className="mb-6 text-sm leading-relaxed text-black/80">
                  Visualizá tu cuota actual, la próxima y tu historial completo. El pago es por adelantado y todos los cambios se reflejan automáticamente. Tu saldo se gestiona con total transparencia.
                </p>
                <div className="relative mx-auto mt-auto w-full max-w-[280px] shrink-0">
                  <div className="relative rounded-[2.5rem] border-4 border-gray-800 bg-black p-2 shadow-2xl">
                    <div className="relative w-full overflow-hidden rounded-[2rem] bg-black aspect-[1080/1048]">
                      <img
                        src="/tutorial/balancemobile.jpeg"
                        alt="Vista móvil de Balance"
                        className="absolute inset-0 h-full w-full object-contain object-top"
                      />
                    </div>
                  </div>
                  <div className="pointer-events-none absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-white/5 to-transparent" />
                </div>
              </div>
            </div>
          </div>

          {/* Funcionalidades adicionales */}
          <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3 md:items-stretch">
            {/* Vacantes */}
            <div className="flex h-full flex-col rounded-2xl border-2 border-black/20 bg-white p-6 shadow-lg transition-colors duration-300 hover:border-black/35 hover:bg-neutral-200/90">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border-2 border-black/20 bg-black/5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6 text-black">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-bold text-black">Vacantes disponibles</h3>
              <p className="mt-auto text-sm leading-relaxed text-black/70">
                Visualización y reserva de todos los cupos que no hayan sido agendados, o bien que hayan sido cancelados por otros alumnos.
              </p>
            </div>

            {/* Cancelación */}
            <div className="flex h-full flex-col rounded-2xl border-2 border-black/20 bg-white p-6 shadow-lg transition-colors duration-300 hover:border-black/35 hover:bg-neutral-200/90">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border-2 border-black/20 bg-black/5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6 text-black">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-bold text-black">Cancelación fácil</h3>
              <p className="mt-auto text-sm leading-relaxed text-black/70">
                Cancelá tus clases desde la app y tu crédito se ajusta automáticamente.
              </p>
            </div>

            {/* Guía */}
            <div className="flex h-full flex-col rounded-2xl border-2 border-black/20 bg-white p-6 shadow-lg transition-colors duration-300 hover:border-black/35 hover:bg-neutral-200/90">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border-2 border-black/20 bg-black/5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6 text-black">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172-1.025 3.07-1.025 4.242 0 1.926 1.915 1.926 5.055 0 6.97l-1.509 1.499c-.32.319-.74.557-1.193.74a6.56 6.56 0 01-1.771.31c-.61 0-1.217-.103-1.771-.31a5.811 5.811 0 01-1.193-.74l-1.51-1.499a4.975 4.975 0 010-6.97z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-bold text-black">Guía y soporte</h3>
              <p className="mt-auto text-sm leading-relaxed text-black/70">
                Tutorial de bienvenida y acceso a la guía completa en tu panel. Contactános por WhatsApp si tenés dudas.
              </p>
            </div>
          </div>

          {/* CTA Final */}
          <div className="text-center">
            <Button
              onClick={() => navigate('/login')}
              className="bg-black text-white hover:bg-gray-800 rounded-lg px-8 py-3 text-base font-medium transition-all duration-200 shadow-lg"
            >
              Acceder a mi panel
            </Button>
          </div>
        </div>
      </section>

      {/* Sección de Ubicación */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-900 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          {/* Header de la sección */}
          <div className="text-center mb-12">
            <h2 className="text-[26px] sm:text-[32px] md:text-[44px] font-bold mb-6 text-white">
              Nuestra ubicación
            </h2>
            <p className="text-[14px] sm:text-[16px] text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Visitános en nuestro espacio
            </p>
            <div className="w-24 h-1 bg-gradient-to-r from-transparent via-white to-transparent mx-auto mt-6"></div>
          </div>

          {/* Mapa */}
          <div className="max-w-4xl mx-auto">
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10 h-[300px] sm:h-[350px] relative bg-gray-800">
              <iframe
                src="https://www.google.com/maps?q=Av.+Pres.+Perón+2485,+Victoria,+Provincia+de+Buenos+Aires&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Ubicación de MALDA - Av. Pres. Perón 2485, Victoria"
              ></iframe>
              {/* Overlay con botón para abrir en Google Maps */}
              <div className="absolute bottom-4 right-4">
                <a
                  href="https://maps.app.goo.gl/hEMkGw8Nc9FRSMcq7"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white text-black px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors shadow-lg flex items-center gap-2 text-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                  Abrir en Maps
                </a>
              </div>
            </div>
            {/* Botón para abrir en Google Maps */}
            <div className="mt-4 text-center">
              <a
                href="https://maps.app.goo.gl/hEMkGw8Nc9FRSMcq7"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-white hover:text-gray-300 transition-colors text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
                Ver ubicación en Google Maps
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black border-t border-white/10 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Columna 1: Logo */}
            <div>
              <div className="mb-4">
                <img
                  src="/assets/logovertical.svg"
                  alt="MALDA Logo"
                  className="h-28 w-auto max-w-[200px] object-contain md:h-36"
                />
              </div>
            </div>

            {/* Columna 2: Enlaces rápidos */}
            <div>
              <h3 className="text-white font-semibold mb-4">Enlaces rápidos</h3>
              <ul className="space-y-2">
                <li>
                  <a 
                    href="#como-funciona" 
                    onClick={(e) => handleSmoothScroll(e, 'como-funciona')}
                    className="text-gray-400 hover:text-white text-sm transition-colors cursor-pointer"
                  >
                    ¿Cómo funciona?
                  </a>
                </li>
                <li>
                  <a 
                    href="#planes" 
                    onClick={(e) => handleSmoothScroll(e, 'planes')}
                    className="text-gray-400 hover:text-white text-sm transition-colors cursor-pointer"
                  >
                    Planes
                  </a>
                </li>
                <li>
                  <a 
                    href="#app" 
                    onClick={(e) => handleSmoothScroll(e, 'app')}
                    className="text-gray-400 hover:text-white text-sm transition-colors cursor-pointer"
                  >
                    App
                  </a>
                </li>
                <li>
                  <a href="/login" className="text-gray-400 hover:text-white text-sm transition-colors">
                    Iniciar sesión
                  </a>
                </li>
              </ul>
            </div>

            {/* Columna 3: Contacto */}
            <div>
              <h3 className="text-white font-semibold mb-4">Contacto</h3>
              <ul className="space-y-2">
                <li>
                  <a 
                    href="https://wa.link/tcs28v" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    WhatsApp
                  </a>
                </li>
                <li>
                  <a 
                    href="https://instagram.com/maldagym" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    Instagram
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Línea divisoria y copyright */}
          <div className="border-t border-white/10 pt-8">
            <div className="flex justify-center items-center gap-2">
              <span className="text-gray-500 text-sm">Powered by</span>
              <a
                href="https://www.agarucorp.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
                aria-label="AgaruCorp"
              >
                <img
                  src="/agarucorp-logo.svg"
                  alt="AgaruCorp"
                  className="h-2.5 w-auto opacity-80 transition-opacity hover:opacity-100"
                />
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Botón flotante de WhatsApp (oculto de forma temporal) */}
      {SHOW_LANDING_WHATSAPP_FAB && (
      <a
        href="https://wa.link/tcs28v"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 group"
        aria-label="Contactar por WhatsApp"
      >
        <div className="relative">
          {/* Botón principal */}
          <div className="relative bg-[#25D366] hover:bg-[#20BA5A] rounded-full p-4 shadow-2xl transition-all duration-300 hover:scale-110">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-7 h-7 text-white"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
          </div>
          
          {/* Tooltip */}
          <div className="absolute right-full mr-3 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg whitespace-nowrap shadow-lg">
              ¿Tenés alguna duda?
              <div className="absolute left-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-l-gray-900"></div>
            </div>
          </div>
        </div>
      </a>
      )}
    </div>
  );
};

export default LandingPage;
