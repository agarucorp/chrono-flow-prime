import { useState } from 'react';

export const useAdminNavigation = () => {
  const [activeTab, setActiveTab] = useState('usuarios');

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return {
    activeTab,
    handleTabChange
  };
};
