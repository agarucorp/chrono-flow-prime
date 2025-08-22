import { useState } from 'react';

export const useAdminNavigation = () => {
  const [activeTab, setActiveTab] = useState('balance');

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return {
    activeTab,
    handleTabChange
  };
};
