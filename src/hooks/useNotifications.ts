import { toast } from 'sonner'

export const useNotifications = () => {
  const showSuccess = (message: string, description?: string) => {
    toast.success(message, {
      description,
      duration: 4000,
      position: 'top-right',
    })
  }

  const showError = (message: string, description?: string) => {
    toast.error(message, {
      description,
      duration: 6000,
      position: 'top-right',
    })
  }

  const showInfo = (message: string, description?: string) => {
    toast.info(message, {
      description,
      duration: 4000,
      position: 'top-right',
    })
  }

  const showWarning = (message: string, description?: string) => {
    toast.warning(message, {
      description,
      duration: 5000,
      position: 'top-right',
    })
  }

  const showLoading = (message: string) => {
    return toast.loading(message, {
      position: 'top-right',
    })
  }

  const dismissToast = (toastId: string | number) => {
    toast.dismiss(toastId)
  }

  return {
    showSuccess,
    showError,
    showInfo,
    showWarning,
    showLoading,
    dismissToast
  }
}
