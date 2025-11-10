import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

interface TutorialSlideImage {
  src: string
  alt: string
}

interface TutorialSlide {
  title: string
  description: string
  images?: TutorialSlideImage[]
}

interface OnboardingTutorialProps {
  open: boolean
  slides: TutorialSlide[]
  onClose: () => void
}

export const OnboardingTutorial = ({ open, slides, onClose }: OnboardingTutorialProps) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')

  useEffect(() => {
    if (open) {
      setCurrentIndex(0)
      setDirection('forward')
    }
  }, [open])

  if (!open) return null

  const currentSlide = slides[currentIndex]
  const isLastSlide = currentIndex === slides.length - 1
  const isFirstSlide = currentIndex === 0

  const renderDots = () => (
    <div className="flex items-center gap-2">
      {slides.map((_, index) => (
        <span
          key={`dot-${index}`}
          className={`h-2 w-2 rounded-full transition-all ${
            index === currentIndex ? 'bg-white' : 'bg-white/40'
          }`}
        />
      ))}
    </div>
  )

  const handleNext = () => {
    setDirection('forward')
    if (isLastSlide) {
      onClose()
      return
    }
    setCurrentIndex((prev) => Math.min(prev + 1, slides.length - 1))
  }

  const handleBack = () => {
    if (isFirstSlide) return
    setDirection('backward')
    setCurrentIndex((prev) => Math.max(prev - 1, 0))
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 px-3 py-6">
      <div className="w-full max-w-3xl bg-background border border-border/60 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex flex-col gap-4 p-4 sm:p-10 overflow-y-auto">
          <div className="flex justify-center sm:hidden">
            <div className="text-white/70">{renderDots()}</div>
          </div>
          <div className="hidden sm:flex justify-end text-white/70">
            {renderDots()}
          </div>

          <div className="relative w-full overflow-hidden">
            <div
              key={`${currentIndex}-${direction}`}
              className="w-full transition-transform duration-700 ease-[cubic-bezier(0.83,0,0.17,1)]"
              style={{
                transform: direction === 'forward' ? 'translateX(0)' : 'translateX(0)',
                animation: direction === 'forward' ? 'slideInFromRight 0.7s ease-in-out forwards' : 'slideInFromLeft 0.7s ease-in-out forwards'
              }}
            >
              {currentSlide.images?.length ? (
                currentSlide.images.map((image, index) => (
                  <div
                    key={`${image.src}-${index}`}
                    className={`relative overflow-hidden ${currentSlide.images && currentSlide.images.length > 1 && index !== 0 ? 'hidden sm:block' : ''}`}
                  >
                    <img
                      src={image.src}
                      alt={image.alt}
                      className="mx-auto h-[80%] w-auto rounded-2xl border border-border/60 object-contain sm:h-full sm:w-full"
                      loading="lazy"
                    />
                  </div>
                ))
              ) : (
                <div className="flex h-28 sm:h-48 items-center justify-center text-muted-foreground text-xs sm:text-sm">
                  Imagen del panel
                </div>
              )}
            </div>

            <div className="relative overflow-hidden">
              <div
                key={`content-${currentIndex}-${direction}`}
                className="space-y-4"
                style={{
                  animation: direction === 'forward' ? 'slideInFromRight 0.7s ease-in-out forwards' : 'slideInFromLeft 0.7s ease-in-out forwards'
                }}
              >
                <h2 className="text-[12px] sm:text-[22px] font-semibold tracking-tight text-foreground">
                  {currentSlide.title}
                </h2>
                <p className="text-[11px] font-light sm:text-[13px] sm:font-normal text-muted-foreground leading-relaxed">
                  {currentSlide.description}
                </p>
              </div>
            </div>

            <div className="hidden sm:flex sm:justify-end sm:gap-6">
              <button
                type="button"
                onClick={handleBack}
                disabled={isFirstSlide}
                className={`text-[10px] sm:text-xs uppercase tracking-[0.3em] text-white/80 hover:text-white transition-colors ${isFirstSlide ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-white hover:text-white/90 transition-colors"
              >
                {isLastSlide ? 'Ingresar' : 'Siguiente'}
              </button>
            </div>
          </div>
        </div>
        <div className="flex sm:hidden justify-between items-center px-6 pb-6 pt-2">
          <button
            type="button"
            onClick={handleBack}
            disabled={isFirstSlide}
            className={`text-[10px] uppercase tracking-[0.3em] text-white/80 hover:text-white transition-colors ${isFirstSlide ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Volver
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="text-[10px] uppercase tracking-[0.3em] text-white hover:text-white/90 transition-colors"
          >
            {isLastSlide ? 'Ingresar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  )
}

