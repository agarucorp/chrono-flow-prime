import { useEffect, useState } from 'react'

interface TutorialSlideImage {
  src: string
  alt: string
  desktopOnly?: boolean
  mobileOnly?: boolean
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
  const hasImages = Boolean(currentSlide.images?.length)
  const hasMobileImage = hasImages
    ? currentSlide.images!.some((img) => !img.desktopOnly)
    : false
  const hasDesktopImage = hasImages
    ? currentSlide.images!.some((img) => !img.mobileOnly)
    : false
  const onlyDesktopImages = hasImages && !hasMobileImage
  const onlyMobileImages = hasImages && !hasDesktopImage

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
    <div className="fixed inset-0 z-[110] flex items-center sm:items-center justify-center bg-black/80 px-3 py-4 sm:py-6">
      <div className="w-full max-w-3xl bg-black border-2 border-white sm:border-2 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden h-[65vh] sm:h-auto sm:max-h-[90vh] flex flex-col">
        <div className="flex flex-col px-4 sm:p-10 overflow-y-auto flex-1">
          <div className="flex justify-center sm:hidden pt-4 pb-2">
            <div className="text-white/70">{renderDots()}</div>
          </div>

          <div className="relative w-full overflow-hidden flex-1 flex items-center justify-center sm:items-start sm:justify-start">
            <div
              key={`${currentIndex}-${direction}`}
              className="w-full transition-transform duration-700 ease-[cubic-bezier(0.83,0,0.17,1)]"
              style={{
                transform: direction === 'forward' ? 'translateX(0)' : 'translateX(0)',
                animation: direction === 'forward' ? 'slideInFromRight 0.7s ease-in-out forwards' : 'slideInFromLeft 0.7s ease-in-out forwards'
              }}
            >
              <div className="flex flex-col items-center sm:items-start">
                {currentSlide.images?.length ? (
                  <>
                    {currentSlide.images.map((image, index) => {
                      const isExtraImage =
                        currentSlide.images && currentSlide.images.length > 1 && index !== 0
                      const extraClass = isExtraImage && !image.mobileOnly ? 'hidden sm:block' : ''
                      const visibilityClass = image.desktopOnly
                        ? 'hidden sm:block'
                        : image.mobileOnly
                          ? 'sm:hidden'
                          : ''
                      return (
                        <div
                          key={`${image.src}-${index}`}
                          className={`relative overflow-hidden flex justify-center sm:justify-start ${extraClass} ${visibilityClass}`}
                        >
                          <img
                            src={image.src}
                            alt={image.alt}
                            className="mx-auto sm:mx-0 h-[220px] sm:h-48 w-auto rounded-2xl object-contain"
                            loading="lazy"
                          />
                        </div>
                      )
                    })}
                    {onlyDesktopImages && (
                      <div className="flex h-[220px] items-center justify-center text-muted-foreground text-xs sm:hidden">
                        Imagen del panel
                      </div>
                    )}
                    {onlyMobileImages && (
                      <div className="hidden sm:flex h-48 items-center justify-center text-muted-foreground text-sm">
                        Imagen del panel
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex h-[220px] sm:h-48 items-center justify-center text-muted-foreground text-xs sm:text-sm">
                    Imagen del panel
                  </div>
                )}

                <div className="relative overflow-hidden mt-6 sm:mt-0 w-full flex flex-col items-center sm:items-start">
                  <div
                    key={`content-${currentIndex}-${direction}`}
                    className="space-y-0 sm:space-y-0 flex flex-col items-center sm:items-start text-center sm:text-left"
                    style={{
                      animation: direction === 'forward' ? 'slideInFromRight 0.7s ease-in-out forwards' : 'slideInFromLeft 0.7s ease-in-out forwards'
                    }}
                  >
                    <h2 className="text-[19px] sm:text-[20px] font-semibold tracking-tight text-white">
                      {currentSlide.title}
                    </h2>
                    <p className="text-[15px] font-light sm:text-[12px] sm:font-normal text-muted-foreground leading-relaxed">
                      {currentSlide.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden sm:flex sm:justify-end sm:gap-6">
              <button
                type="button"
                onClick={handleBack}
                disabled={isFirstSlide}
                className={`text-[10px] sm:text-[10px] uppercase tracking-[0.3em] text-white/80 hover:text-white transition-colors ${isFirstSlide ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="text-[10px] sm:text-[10px] uppercase tracking-[0.3em] text-white hover:text-white/90 transition-colors"
              >
                {isLastSlide ? 'Ingresar' : 'Siguiente'}
              </button>
            </div>
          </div>
        </div>
        <div className="flex sm:hidden justify-between items-center px-4 py-6">
          <button
            type="button"
            onClick={handleBack}
            disabled={isFirstSlide}
            className={`text-[12px] uppercase tracking-[0.3em] text-white/80 hover:text-white transition-colors ${isFirstSlide ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Volver
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="text-[12px] uppercase tracking-[0.3em] text-white hover:text-white/90 transition-colors"
          >
            {isLastSlide ? 'Ingresar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  )
}

