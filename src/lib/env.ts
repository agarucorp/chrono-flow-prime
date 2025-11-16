export const isEmailConfirmDisabledDev = (): boolean => {
  try {
    const flag = import.meta?.env?.VITE_DISABLE_EMAIL_CONFIRM;
    return String(flag).toLowerCase() === 'true';
  } catch {
    return false;
  }
};


