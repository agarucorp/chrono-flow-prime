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
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useAdmin, AdminUser } from '@/hooks/useAdmin';
import { useNotifications } from '@/hooks/useNotifications';
import { Navigation } from '@/components/Navigation';

export default function Admin() {
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

  // Cargar datos al montar el componente
  useEffect(() => {
    if (isAdmin) {
      fetchAllUsers();
      fetchAdminUsers();
    }
  }, [isAdmin, fetchAllUsers, fetchAdminUsers]);

  // Filtrar usuarios según búsqueda y filtro
  const filteredUsers = allUsers.filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    
    return matchesSearch && matchesRole;
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
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Crown className="w-8 h-8 text-yellow-500" />
                Panel de Administración
              </h1>
              <p className="text-muted-foreground mt-2">
                Gestiona usuarios, roles y configuraciones del sistema
              </p>
            </div>
            <Badge variant="secondary" className="text-sm">
              {adminUsers.length} Administradores
            </Badge>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuarios</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allUsers.length}</div>
              <p className="text-xs text-muted-foreground">
                Usuarios registrados en el sistema
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Administradores</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminUsers.length}</div>
              <p className="text-xs text-muted-foreground">
                Usuarios con permisos de admin
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allUsers.filter(u => u.role === 'client').length}</div>
              <p className="text-xs text-muted-foreground">
                Usuarios con rol de cliente
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
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
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Gestión de Usuarios</CardTitle>
            <CardDescription>
              Administra roles y permisos de los usuarios del sistema
            </CardDescription>
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
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowUserDetails(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
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
    </div>
  );
}
