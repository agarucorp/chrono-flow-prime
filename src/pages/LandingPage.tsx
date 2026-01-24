import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <img src="/tutorial/malda.png" alt="MALDA Logo" className="h-20 w-auto" />
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
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-black min-h-screen flex items-center">
        <div className="max-w-4xl text-left">
          <h1 className="text-[31px] sm:text-[43px] md:text-[55px] lg:text-[67px] font-bold mb-6 leading-[1.1] tracking-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Entrenamiento
            <br />
            <span className="text-[43px] sm:text-[55px] md:text-[67px] lg:text-[79px]">100%</span>
            <br />
            <span className="text-[31px] sm:text-[43px] md:text-[55px] lg:text-[67px]">personalizado.</span>
            <br />
            <span className="text-[31px] sm:text-[43px] md:text-[55px] lg:text-[67px]">Sin vueltas.</span>
          </h1>
          
          <p className="text-[12px] sm:text-[14px] text-gray-300 max-w-2xl mb-10 leading-relaxed mt-8" style={{ fontFamily: 'Poppins, sans-serif' }}>
            MALDA no es un gimnasio convencional ni una clase grupal. Es un espacio de entrenamiento personalizado donde tenés tu propio circuito, un cupo reservado y seguimiento directo.
          </p>

          {/* Botones CTA */}
          <div className="flex flex-col sm:flex-row gap-6 mt-10">
            <Button
              onClick={() => navigate('/login')}
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
      </section>

      {/* Sección de Características */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-900" id="como-funciona">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-[26px] sm:text-[32px] md:text-[44px] font-bold mb-6">
              Un modelo de entrenamiento diseñado para el rendimiento
            </h2>
            <p className="text-[14px] sm:text-[16px] text-gray-400 max-w-3xl mx-auto leading-relaxed">
              En MALDA no pagás una cuota para "venir cuando quieras" - Pagás por un espacio garantizado, un plan profesional y una dinámica de trabajo eficiente.
            </p>
          </div>

          {/* Tarjetas de características */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            {/* Tarjeta 1 */}
            <div className="border border-white rounded-xl p-8 bg-black hover:border-white transition-colors">
              <h3 className="text-xl font-bold mb-4 text-white">Tu lugar reservado</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                El caos de los gimnasios llenos ya no existe. Al inscribirte, elegís tus horarios fijos por mes. Ese cupo es tuyo y de nadie más. Esto nos permite asegurar que siempre tengas el espacio y el equipamiento necesario para completar tu sesión sin esperas.
              </p>
            </div>

            {/* Tarjeta 2 */}
            <div className="border border-white rounded-xl p-8 bg-black hover:border-white transition-colors">
              <h3 className="text-xl font-bold mb-4 text-white">Tu propio circuito</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                No damos clases grupales ni rutinas genéricas. Al llegar, el coach te asigna tu trabajo del día basado en tus objetivos y nivel. Aunque compartas la hora con otros alumnos, tu entrenamiento es individual. Entrenás a tu ritmo, con la técnica bajo supervisión constante.
              </p>
            </div>

            {/* Tarjeta 3 */}
            <div className="border border-white rounded-xl p-8 bg-black hover:border-white transition-colors">
              <h3 className="text-xl font-bold mb-4 text-white">Pagás lo que entrenás</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                Nuestro sistema de pagos premia la constancia. Si por algún motivo tenés que cancelar una clase, lo hacés desde la App. Ese crédito no se pierde y se computa automáticamente como un descuento para tu cuota del mes siguiente. El sistema gestiona tu saldo con transparencia total.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sección Comparativa */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F5F5DC] relative overflow-hidden">
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
            <div className="bg-gray-800/90 backdrop-blur-xl rounded-2xl p-8 sm:p-10 md:p-12 border border-white/20 shadow-2xl">
              {/* Encabezados con diseño mejorado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 mb-10 pb-6 border-b border-white/20 relative">
                <div className="relative">
                  <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-white/30 to-transparent rounded-full"></div>
                  <h3 className="text-lg sm:text-xl font-bold uppercase tracking-wider text-white">
                    MALDA ES...
                  </h3>
                  <div className="mt-2 text-[10px] text-gray-400 uppercase tracking-widest">Nuestra propuesta</div>
                </div>
                <div className="relative">
                  <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-white/30 to-transparent rounded-full"></div>
                  <h3 className="text-lg sm:text-xl font-bold uppercase tracking-wider text-white">
                    DIFERENCIA CON EL RESTO
                  </h3>
                  <div className="mt-2 text-[10px] text-gray-400 uppercase tracking-widest">Lo que nos distingue</div>
                </div>
              </div>

              {/* Filas Comparativas con diseño mejorado */}
              <div className="space-y-7 md:space-y-8">
                {/* Fila 1 */}
                <div className="group relative">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-start">
                    <div className="relative">
                      <h4 className="text-lg sm:text-xl font-bold text-white mb-2 leading-tight">
                        Entrenamiento<br />Personalizado
                      </h4>
                      <div className="w-16 h-0.5 bg-gradient-to-r from-white/40 to-transparent"></div>
                    </div>
                    <div className="relative">
                      <div className="absolute left-0 top-2 w-2 h-2 rounded-full bg-white/40 group-hover:bg-white/60 transition-all duration-300"></div>
                      <p className="text-sm sm:text-base text-gray-300 font-light leading-relaxed pl-4">
                        Tu plan es único. No seguimos coreografías ni rutinas genéricas.
                      </p>
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>

                {/* Fila 2 */}
                <div className="group relative">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-start">
                    <div className="relative">
                      <h4 className="text-lg sm:text-xl font-bold text-white mb-2 leading-tight">
                        Cupos Limitados
                      </h4>
                      <div className="w-16 h-0.5 bg-gradient-to-r from-white/40 to-transparent"></div>
                    </div>
                    <div className="relative">
                      <div className="absolute left-0 top-2 w-2 h-2 rounded-full bg-white/40 group-hover:bg-white/60 transition-all duration-300"></div>
                      <p className="text-sm sm:text-base text-gray-300 font-light leading-relaxed pl-4">
                        Entrenás con espacio y equipo siempre disponible. Sin amontonamientos.
                      </p>
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>

                {/* Fila 3 */}
                <div className="group relative">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-start">
                    <div className="relative">
                      <h4 className="text-lg sm:text-xl font-bold text-white mb-2 leading-tight">
                        Autogestión de Turnos
                      </h4>
                      <div className="w-16 h-0.5 bg-gradient-to-r from-white/40 to-transparent"></div>
                    </div>
                    <div className="relative">
                      <div className="absolute left-0 top-2 w-2 h-2 rounded-full bg-white/40 group-hover:bg-white/60 transition-all duration-300"></div>
                      <p className="text-sm sm:text-base text-gray-300 font-light leading-relaxed pl-4">
                        Cancelás y reprogramás desde la App. Tu saldo se ajusta solo.
                      </p>
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>

                {/* Fila 4 */}
                <div className="group relative">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-start">
                    <div className="relative">
                      <h4 className="text-lg sm:text-xl font-bold text-white mb-2 leading-tight">
                        Atención Directa
                      </h4>
                      <div className="w-16 h-0.5 bg-gradient-to-r from-white/40 to-transparent"></div>
                    </div>
                    <div className="relative">
                      <div className="absolute left-0 top-2 w-2 h-2 rounded-full bg-white/40 group-hover:bg-white/60 transition-all duration-300"></div>
                      <p className="text-sm sm:text-base text-gray-300 font-light leading-relaxed pl-4">
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

          {/* Grid de Planes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mt-12">
            {/* Plan 1 día */}
            <div className="group relative bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 rounded-2xl p-6 border border-white/10 hover:border-white/30 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
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
            <div className="group relative bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 rounded-2xl p-6 border border-white/10 hover:border-white/30 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
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

            {/* Plan 3 días - Destacado */}
            <div className="group relative bg-gradient-to-br from-white/5 via-white/10 to-white/5 rounded-2xl p-6 border-2 border-white/30 hover:border-white/50 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 scale-105 sm:scale-100 lg:scale-105">
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
                  Construye hábitos sólidos de entrenamiento
                </p>
              </div>
            </div>

            {/* Plan 4 días */}
            <div className="group relative bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 rounded-2xl p-6 border border-white/10 hover:border-white/30 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
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
            <div className="group relative bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 rounded-2xl p-6 border border-white/10 hover:border-white/30 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
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
      <section id="app" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F5F5DC] relative overflow-hidden">
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
              <span className="text-sm text-black/70 uppercase tracking-wider">Aplicación móvil</span>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            {/* Columna izquierda: Mis Clases */}
            <div className="order-2 lg:order-1">
              <div className="bg-white rounded-3xl p-8 border-2 border-black/20 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-black/5 border-2 border-black/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-black">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-black">Mis Clases</h3>
                    <p className="text-sm text-black/60">Gestioná tus horarios recurrentes</p>
                  </div>
                </div>
                <p className="text-black/80 text-sm leading-relaxed mb-6">
                  Configurá tus horarios recurrentes de forma fácil. Una vez seleccionados, quedan reservados para vos cada semana. Podés visualizar todas tus clases programadas, cancelarlas cuando lo necesites y reprogramar sin complicaciones.
                </p>
                {/* Mockup móvil con captura */}
                <div className="relative mx-auto" style={{ maxWidth: '280px' }}>
                  <div className="relative bg-black rounded-[2.5rem] p-2 shadow-2xl border-4 border-gray-800">
                    <div className="bg-black rounded-[2rem] overflow-hidden">
                      <img 
                        src="/tutorial/horariomobile.jpeg" 
                        alt="Vista móvil de Mis Clases" 
                        className="w-full h-auto"
                      />
                    </div>
                  </div>
                  {/* Brillo decorativo */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-[2.5rem] pointer-events-none"></div>
                </div>
              </div>
            </div>

            {/* Columna derecha: Balance */}
            <div className="order-1 lg:order-2">
              <div className="bg-white rounded-3xl p-8 border-2 border-black/20 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-black/5 border-2 border-black/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-black">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm0 0h.008v.008H18V10.5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-black">Balance y Pagos</h3>
                    <p className="text-sm text-black/60">Controlá tus finanzas</p>
                  </div>
                </div>
                <p className="text-black/80 text-sm leading-relaxed mb-6">
                  Visualizá tu cuota actual, la próxima y tu historial completo. El pago es por adelantado y todos los cambios se reflejan automáticamente. Tu saldo se gestiona con total transparencia.
                </p>
                {/* Mockup móvil con captura */}
                <div className="relative mx-auto" style={{ maxWidth: '280px' }}>
                  <div className="relative bg-black rounded-[2.5rem] p-2 shadow-2xl border-4 border-gray-800">
                    <div className="bg-black rounded-[2rem] overflow-hidden">
                      <img 
                        src="/tutorial/balancemobile.jpeg" 
                        alt="Vista móvil de Balance" 
                        className="w-full h-auto"
                      />
                    </div>
                  </div>
                  {/* Brillo decorativo */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-[2.5rem] pointer-events-none"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Funcionalidades adicionales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {/* Vacantes */}
            <div className="bg-white rounded-2xl p-6 border-2 border-black/20 hover:border-black/40 transition-all duration-300 shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-black/5 border-2 border-black/20 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-black">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-black mb-2">Vacantes disponibles</h3>
              <p className="text-black/70 text-sm leading-relaxed">
                Reservá clases canceladas por otros alumnos en tiempo real.
              </p>
            </div>

            {/* Cancelación */}
            <div className="bg-white rounded-2xl p-6 border-2 border-black/20 hover:border-black/40 transition-all duration-300 shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-black/5 border-2 border-black/20 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-black">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-black mb-2">Cancelación fácil</h3>
              <p className="text-black/70 text-sm leading-relaxed">
                Cancelá tus clases desde la App y tu crédito se ajusta automáticamente.
              </p>
            </div>

            {/* Guía */}
            <div className="bg-white rounded-2xl p-6 border-2 border-black/20 hover:border-black/40 transition-all duration-300 shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-black/5 border-2 border-black/20 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-black">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172-1.025 3.07-1.025 4.242 0 1.926 1.915 1.926 5.055 0 6.97l-1.509 1.499c-.32.319-.74.557-1.193.74a6.56 6.56 0 01-1.771.31c-.61 0-1.217-.103-1.771-.31a5.811 5.811 0 01-1.193-.74l-1.51-1.499a4.975 4.975 0 010-6.97z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-black mb-2">Guía y soporte</h3>
              <p className="text-black/70 text-sm leading-relaxed">
                Accedé a la guía completa y contactanos por WhatsApp si tenés dudas.
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
                <img src="/biglogo.png" alt="MALDA Logo" className="h-36 w-auto" />
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
              <img src="/agarucorp-logo.svg" alt="AgaruCorp" className="h-2.5 w-auto" />
            </div>
          </div>
        </div>
      </footer>

      {/* Botón flotante de WhatsApp */}
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
    </div>
  );
};

export default LandingPage;
