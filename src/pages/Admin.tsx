import { useState, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  UserPlus, 
  UserMinus, 
  Crown, 
  User, 
  Calendar,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Settings,
  Clock,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { useAdmin, AdminUser } from '@/hooks/useAdmin';
import { useNotifications } from '@/hooks/useNotifications';
import { CalendarView } from '@/components/CalendarView';
import { TurnoManagement } from '@/components/TurnoManagement';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Footer } from '@/components/Footer';
import { useAdminNavigation } from '@/hooks/useAdminNavigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthContext } from '@/contexts/AuthContext';

export default function Admin() {
  const { user, signOut } = useAuthContext();
  const { activeTab, handleTabChange } = useAdminNavigation();
  const { 
    isAdmin, 
    isLoading, 
    adminUsers, 
    allUsers, 
    fetchAllUsers, 
    fetchAdminUsers,
    changeUserRole,
    deleteUser,
    canBeAdmin
  } = useAdmin();
  
  const { showSuccess, showError, showWarning, showLoading, dismissToast } = useNotifications();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'client'>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState<'all' | '2024-01' | '2024-02' | '2024-03' | '2024-04' | '2024-05' | '2024-06' | '2024-07' | '2024-08' | '2024-09' | '2024-10' | '2024-11' | '2024-12' | '2025-01' | '2025-02' | '2025-03' | '2025-04' | '2025-05' | '2025-06' | '2025-07' | '2025-08' | '2025-09' | '2025-10' | '2025-11' | '2025-12'>('all');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  

  // Función para obtener las iniciales del usuario
  const getInitials = (email: string) => {
    if (!email) return 'A';
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email[0].toUpperCase();
  };

  // Función para obtener el nombre del usuario
  const getUserName = (email: string) => {
    if (!email) return 'Admin';
    const name = email.split('@')[0];
    // Separar por punto y capitalizar cada parte
    const parts = name.split('.');
    if (parts.length >= 2) {
      return parts.map(part => 
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      ).join(' ');
    }
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // La redirección se maneja automáticamente en el contexto
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };
  

  // Cargar datos al montar el componente
  useEffect(() => {
    if (isAdmin) {
      fetchAllUsers();
      fetchAdminUsers();
    }
  }, [isAdmin, fetchAllUsers, fetchAdminUsers]);

  // Filtrar usuarios según búsqueda y filtros
  const filteredUsers = allUsers.filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    
    // Filtro de período por mes específico
    let matchesPeriod = true;
    if (filterPeriod !== 'all') {
      const [year, month] = filterPeriod.split('-');
      const userDate = new Date(user.created_at);
      matchesPeriod = userDate.getFullYear() === parseInt(year) &&
                     userDate.getMonth() + 1 === parseInt(month);
    }
    
    // Por ahora, el filtro de estado de pago no está implementado
    // Se puede agregar cuando se conecte con la tabla de pagos
    const matchesPaymentStatus = true; // TODO: Implementar filtro de estado de pago
    
    return matchesSearch && matchesRole && matchesPeriod && matchesPaymentStatus;
  });

  // Cambiar rol de usuario
  const handleRoleChange = async (userId: string, newRole: 'client' | 'admin') => {
    const loadingToast = showLoading('Cambiando rol de usuario...');
    
    const result = await changeUserRole(userId, newRole);
    
    dismissToast(loadingToast);
    
    if (result.success) {
      showSuccess('Rol actualizado', 'El rol del usuario ha sido cambiado exitosamente');
    } else {
      showError('Error al cambiar rol', result.error || 'No se pudo cambiar el rol');
    }
  };

  // Eliminar usuario
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar a ${userName}? Esta acción no se puede deshacer.`)) {
      return;
    }

    const loadingToast = showLoading('Eliminando usuario...');
    
    const result = await deleteUser(userId);
    
    dismissToast(loadingToast);
    
    if (result.success) {
      showSuccess('Usuario eliminado', 'El usuario ha sido eliminado exitosamente');
    } else {
      showError('Error al eliminar usuario', result.error || 'No se pudo eliminar el usuario');
    }
  };

  // Si no es admin, mostrar mensaje de acceso denegado
  if (!isAdmin && !isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Acceso Denegado</h1>
          <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  // Si está cargando, mostrar spinner
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold mb-2">Verificando permisos...</h2>
          <p className="text-muted-foreground">Comprobando tu rol de administrador.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b shadow-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo centrado */}
            <div className="flex-1 flex justify-center">
              <div className="w-32 h-12">
                <img src="/letrasgym.png" alt="Logo Letras Gym" className="w-full h-full object-contain" />
              </div>
            </div>
            
            {/* Menú de usuario */}
            <div className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-10 w-10 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
                  >
                    <span className="text-sm font-medium text-primary">
                      {getInitials(user?.email || '')}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex flex-col space-y-1 p-2">
                    <p className="text-sm font-medium leading-none">{getUserName(user?.email || '')}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar Sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Tabs principales */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="usuarios" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Usuarios</span>
            </TabsTrigger>
            <TabsTrigger value="turnos" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Gestión Turnos</span>
            </TabsTrigger>
            <TabsTrigger value="calendario" className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Calendario</span>
            </TabsTrigger>
          </TabsList>




          {/* Tab de Usuarios */}
          <TabsContent value="usuarios" className="mt-6">

            {/* Search and Filters */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* Búsqueda */}
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar usuarios por nombre o email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={filterRole === 'all' ? 'default' : 'outline'}
                        onClick={() => setFilterRole('all')}
                        size="sm"
                      >
                        Todos
                      </Button>
                      <Button
                        variant={filterRole === 'admin' ? 'default' : 'outline'}
                        onClick={() => setFilterRole('admin')}
                        size="sm"
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Admins
                      </Button>
                      <Button
                        variant={filterRole === 'client' ? 'default' : 'outline'}
                        onClick={() => setFilterRole('client')}
                        size="sm"
                      >
                        <User className="w-4 h-4 mr-2" />
                        Clientes
                      </Button>
                    </div>
                  </div>

                  {/* Filtros adicionales */}
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">Período:</span>
                      <Select value={filterPeriod} onValueChange={(value: any) => setFilterPeriod(value)}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Seleccionar período" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los períodos</SelectItem>
                          <SelectItem value="2024-01">Enero 2024</SelectItem>
                          <SelectItem value="2024-02">Febrero 2024</SelectItem>
                          <SelectItem value="2024-03">Marzo 2024</SelectItem>
                          <SelectItem value="2024-04">Abril 2024</SelectItem>
                          <SelectItem value="2024-05">Mayo 2024</SelectItem>
                          <SelectItem value="2024-06">Junio 2024</SelectItem>
                          <SelectItem value="2024-07">Julio 2024</SelectItem>
                          <SelectItem value="2024-08">Agosto 2024</SelectItem>
                          <SelectItem value="2024-09">Septiembre 2024</SelectItem>
                          <SelectItem value="2024-10">Octubre 2024</SelectItem>
                          <SelectItem value="2024-11">Noviembre 2024</SelectItem>
                          <SelectItem value="2024-12">Diciembre 2024</SelectItem>
                          <SelectItem value="2025-01">Enero 2025</SelectItem>
                          <SelectItem value="2025-02">Febrero 2025</SelectItem>
                          <SelectItem value="2025-03">Marzo 2025</SelectItem>
                          <SelectItem value="2025-04">Abril 2025</SelectItem>
                          <SelectItem value="2025-05">Mayo 2025</SelectItem>
                          <SelectItem value="2025-06">Junio 2025</SelectItem>
                          <SelectItem value="2025-07">Julio 2025</SelectItem>
                          <SelectItem value="2025-08">Agosto 2025</SelectItem>
                          <SelectItem value="2025-09">Septiembre 2025</SelectItem>
                          <SelectItem value="2025-10">Octubre 2025</SelectItem>
                          <SelectItem value="2025-11">Noviembre 2025</SelectItem>
                          <SelectItem value="2025-12">Diciembre 2025</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">Estado de Pago:</span>
                      <Select value={filterPaymentStatus} onValueChange={(value: any) => setFilterPaymentStatus(value)}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Seleccionar estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los estados</SelectItem>
                          <SelectItem value="paid">Pagado</SelectItem>
                          <SelectItem value="pending">Pendiente</SelectItem>
                          <SelectItem value="overdue">Vencido</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-2 ml-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearchTerm('');
                          setFilterRole('all');
                          setFilterPeriod('all');
                          setFilterPaymentStatus('all');
                        }}
                      >
                        Limpiar Filtros
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resumen de filtros activos */}
            {(filterRole !== 'all' || filterPeriod !== 'all' || filterPaymentStatus !== 'all' || searchTerm) && (
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Filtros activos:</span>
                    {filterRole !== 'all' && (
                      <Badge variant="secondary" className="text-xs">
                        Rol: {filterRole === 'admin' ? 'Administradores' : 'Clientes'}
                      </Badge>
                    )}
                    {filterPeriod !== 'all' && (
                      <Badge variant="secondary" className="text-xs">
                        Período: {
                          filterPeriod === '2024-01' ? 'Enero 2024' :
                          filterPeriod === '2024-02' ? 'Febrero 2024' :
                          filterPeriod === '2024-03' ? 'Marzo 2024' :
                          filterPeriod === '2024-04' ? 'Abril 2024' :
                          filterPeriod === '2024-05' ? 'Mayo 2024' :
                          filterPeriod === '2024-06' ? 'Junio 2024' :
                          filterPeriod === '2024-07' ? 'Julio 2024' :
                          filterPeriod === '2024-08' ? 'Agosto 2024' :
                          filterPeriod === '2024-09' ? 'Septiembre 2024' :
                          filterPeriod === '2024-10' ? 'Octubre 2024' :
                          filterPeriod === '2024-11' ? 'Noviembre 2024' :
                          filterPeriod === '2024-12' ? 'Diciembre 2024' :
                          filterPeriod === '2025-01' ? 'Enero 2025' :
                          filterPeriod === '2025-02' ? 'Febrero 2025' :
                          filterPeriod === '2025-03' ? 'Marzo 2025' :
                          filterPeriod === '2025-04' ? 'Abril 2025' :
                          filterPeriod === '2025-05' ? 'Mayo 2025' :
                          filterPeriod === '2025-06' ? 'Junio 2025' :
                          filterPeriod === '2025-07' ? 'Julio 2025' :
                          filterPeriod === '2025-08' ? 'Agosto 2025' :
                          filterPeriod === '2025-09' ? 'Septiembre 2025' :
                          filterPeriod === '2025-10' ? 'Octubre 2025' :
                          filterPeriod === '2025-11' ? 'Noviembre 2025' :
                          'Diciembre 2025'
                        }
                      </Badge>
                    )}
                    {filterPaymentStatus !== 'all' && (
                      <Badge variant="secondary" className="text-xs">
                        Pago: {
                          filterPaymentStatus === 'paid' ? 'Pagado' :
                          filterPaymentStatus === 'pending' ? 'Pendiente' :
                          'Vencido'
                        }
                      </Badge>
                    )}
                    {searchTerm && (
                      <Badge variant="secondary" className="text-xs">
                        Búsqueda: "{searchTerm}"
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {filteredUsers.length} usuario{filteredUsers.length !== 1 ? 's' : ''} encontrado{filteredUsers.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Users Table */}
            <Card>
              <CardHeader>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Usuario</th>
                        <th className="text-left p-3 font-medium">Email</th>
                        <th className="text-left p-3 font-medium">Rol</th>
                        <th className="text-left p-3 font-medium">Fecha</th>
                        <th className="text-left p-3 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="border-b hover:bg-muted/50">
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                {user.role === 'admin' ? (
                                  <Crown className="w-4 h-4 text-yellow-600" />
                                ) : (
                                  <User className="w-4 h-4 text-primary" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">{user.full_name}</p>
                                <p className="text-sm text-muted-foreground">ID: {user.id.slice(0, 8)}...</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <p className="text-sm">{user.email}</p>
                          </td>
                          <td className="p-3">
                            <Badge 
                              variant={user.role === 'admin' ? 'default' : 'secondary'}
                              className={user.role === 'admin' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
                            >
                              {user.role === 'admin' ? 'Administrador' : 'Cliente'}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <p className="text-sm text-muted-foreground">
                              {new Date(user.created_at).toLocaleDateString('es-ES')}
                            </p>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => { setSelectedUser(user); setShowUserDetails(true); }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <span className="sr-only">Abrir menú</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => { setSelectedUser(user); setShowUserDetails(true); }}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    Ver Detalles
                                  </DropdownMenuItem>
                                  {user.role === 'client' && canBeAdmin(user.email) && (
                                    <DropdownMenuItem
                                      onClick={() => handleRoleChange(user.id, 'admin')}
                                      className="text-yellow-600"
                                    >
                                      <Crown className="w-4 h-4 mr-2" />
                                      Hacer Administrador
                                    </DropdownMenuItem>
                                  )}
                                  
                                  {user.role === 'admin' && (
                                    <DropdownMenuItem
                                      onClick={() => handleRoleChange(user.id, 'client')}
                                      className="text-blue-600"
                                    >
                                      <User className="w-4 h-4 mr-2" />
                                      Hacer Cliente
                                    </DropdownMenuItem>
                                  )}
                                  
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteUser(user.id, user.full_name)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Eliminar Usuario
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {filteredUsers.length === 0 && (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No se encontraron usuarios</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab de Gestión de Turnos */}
          <TabsContent value="turnos" className="mt-6">
            <TurnoManagement />
          </TabsContent>

          {/* Tab de Calendario */}
          <TabsContent value="calendario" className="mt-6">
            <CalendarView isAdminView={true} />
          </TabsContent>
        </Tabs>
      </div>

      {/* User Details Modal */}
      {showUserDetails && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {selectedUser.role === 'admin' ? (
                  <Crown className="w-5 h-5 text-yellow-500" />
                ) : (
                  <User className="w-5 h-5 text-primary" />
                )}
                Detalles del Usuario
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nombre Completo</label>
                <p className="text-sm text-muted-foreground">{selectedUser.full_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Rol</label>
                <Badge 
                  variant={selectedUser.role === 'admin' ? 'default' : 'secondary'}
                  className={selectedUser.role === 'admin' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
                >
                  {selectedUser.role === 'admin' ? 'Administrador' : 'Cliente'}
                </Badge>
              </div>
              <div>
                <label className="text-sm font-medium">Fecha de Registro</label>
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedUser.created_at).toLocaleString('es-ES')}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">ID de Usuario</label>
                <p className="text-sm text-muted-foreground font-mono">{selectedUser.id}</p>
              </div>
            </CardContent>
            <div className="p-6 pt-0 flex justify-end">
              <Button onClick={() => setShowUserDetails(false)}>
                Cerrar
              </Button>
            </div>
          </Card>
        </div>
      )}

      <Footer />
    </div>
  );
}
