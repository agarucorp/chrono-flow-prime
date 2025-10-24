import { useState, useEffect } from 'react';

export const useAdminNavigation = () => {
  // Usar localStorage para persistir el tab activo
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('admin-active-tab');
    return saved || 'usuarios';
  });

  useEffect(() => {
    // Guardar el tab activo en localStorage cada vez que cambie
    localStorage.setItem('admin-active-tab', activeTab);
  }, [activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return {
    activeTab,
    handleTabChange
  };
};
