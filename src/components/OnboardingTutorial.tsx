import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

interface TutorialSlide {
  title: string
  description: string
}

interface OnboardingTutorialProps {
  open: boolean
  slides: TutorialSlide[]
  onClose: (dontShowAgain: boolean) => void
}

export const OnboardingTutorial = ({ open, slides, onClose }: OnboardingTutorialProps) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')

  useEffect(() => {
    if (open) {
      setCurrentIndex(0)
      setDontShowAgain(false)
      setDirection('forward')
    }
  }, [open])

  if (!open) return null

  const currentSlide = slides[currentIndex]
  const isLastSlide = currentIndex === slides.length - 1
  const isFirstSlide = currentIndex === 0

  const handleNext = () => {
    setDirection('forward')
    if (isLastSlide) {
      onClose(dontShowAgain)
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
          <div className="flex justify-between items-center text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span>Paso {currentIndex + 1} de {slides.length}</span>
            <div className="flex items-center gap-2">
              {slides.map((_, index) => (
                <span
                  key={index}
                  className={`h-2 w-2 rounded-full transition-all ${
                    index === currentIndex ? 'bg-white' : 'bg-white/40'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="relative w-full overflow-hidden">
            <div
              key={`${currentIndex}-${direction}`}
              className={`w-full h-28 sm:h-48 rounded-2xl bg-muted/40 border border-dashed border-muted-foreground/40 flex items-center justify-center text-muted-foreground text-xs sm:text-sm transition-transform duration-700 ease-[cubic-bezier(0.83,0,0.17,1)]`}
              style={{
                transform: direction === 'forward' ? 'translateX(0)' : 'translateX(0)',
                animation: direction === 'forward' ? 'slideInFromRight 0.7s ease-in-out forwards' : 'slideInFromLeft 0.7s ease-in-out forwards'
              }}
            >
              Imagen del panel
            </div>
          </div>

          <div className="relative overflow-hidden">
            <div
              key={`content-${currentIndex}-${direction}`}
              className="space-y-4"
              style={{
                animation: direction === 'forward' ? 'slideInFromRight 0.7s ease-in-out forwards' : 'slideInFromLeft 0.7s ease-in-out forwards'
              }}
            >
              <h2 className="text-[12px] sm:text-2xl font-semibold tracking-tight text-foreground">
                {currentSlide.title}
              </h2>
              <p className="text-[12px] sm:text-base text-muted-foreground leading-relaxed">
                {currentSlide.description}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground select-none">
              <Checkbox
                checked={dontShowAgain}
                onCheckedChange={(value) => setDontShowAgain(value === true)}
                className="h-5 w-5 border-2 border-white text-white"
              />
              No volver a mostrar
            </label>

            <div className="hidden sm:flex sm:items-center sm:gap-6">
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

