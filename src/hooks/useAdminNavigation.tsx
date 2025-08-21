import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

export const useAdminNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('historial');

  useEffect(() => {
    if (location.pathname === '/admin/historial') {
      setActiveTab('historial');
    } else if (location.pathname === '/admin') {
      setActiveTab('usuarios');
    }
  }, [location.pathname]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    
    // Navegar a la ruta correspondiente
    switch (value) {
      case 'historial':
        navigate('/admin/historial');
        break;
      case 'usuarios':
        navigate('/admin');
        break;
      default:
        // Para otros tabs, mantener en la ruta actual
        break;
    }
  };

  return {
    activeTab,
    handleTabChange
  };
};
