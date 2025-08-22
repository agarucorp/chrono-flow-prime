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
  Wallet,
  DollarSign
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
import { CalendarView } from '@/components/CalendarView';
import { TurnoManagement } from '@/components/TurnoManagement';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Footer } from '@/components/Footer';
import { HistorialBalance } from '@/components/HistorialBalance';
import { useAdminNavigation } from '@/hooks/useAdminNavigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdminChart } from '@/components/AdminChart';
import { useAdminMetrics } from '@/hooks/useAdminMetrics';

export default function Admin() {
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
  
  // Estados para el análisis de tendencia
  const [metricType, setMetricType] = useState<'ingresos' | 'horas' | 'usuarios' | 'pagos'>('ingresos');
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [selectedMonth, setSelectedMonth] = useState('julio');
  const [selectedYear, setSelectedYear] = useState('2024');
  
  // Hook para métricas del negocio
  const { metrics, isLoading: metricsLoading, getChartData } = useAdminMetrics(selectedMonth, selectedYear);
  
  // Función para obtener descripción de métricas
  function getMetricDescription(type: string, value: number): string {
    switch (type) {
      case 'ingresos':
        return value > 35000 ? 'Excelente' : value > 30000 ? 'Bueno' : 'Regular';
      case 'horas':
        return value > 50 ? 'Alta ocupación' : value > 40 ? 'Ocupación media' : 'Baja ocupación';
      case 'usuarios':
        return value > 10 ? 'Alto crecimiento' : value > 5 ? 'Crecimiento medio' : 'Crecimiento bajo';
      case 'pagos':
        return value > 95 ? 'Excelente' : value > 90 ? 'Bueno' : 'Necesita atención';
      default:
        return '';
    }
  }

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
      <div className="container mx-auto px-4 py-8">
        {/* Tabs principales */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="balance" className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4" />
              <span>Balance</span>
            </TabsTrigger>
            <TabsTrigger value="historial" className="flex items-center space-x-2">
              <Wallet className="h-4 w-4" />
              <span>Historial</span>
            </TabsTrigger>
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

          {/* Tab de Balance */}
          <TabsContent value="balance" className="mt-6">
            <div className="space-y-6">
              {/* Filtro de período */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Seleccionar Período
                  </CardTitle>
                  <CardDescription>
                    Elige el mes y año para visualizar los indicadores
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Año:</span>
                                             <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2023">2023</SelectItem>
                          <SelectItem value="2024">2024</SelectItem>
                          <SelectItem value="2025">2025</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Mes:</span>
                                             <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="enero">Enero</SelectItem>
                          <SelectItem value="febrero">Febrero</SelectItem>
                          <SelectItem value="marzo">Marzo</SelectItem>
                          <SelectItem value="abril">Abril</SelectItem>
                          <SelectItem value="mayo">Mayo</SelectItem>
                          <SelectItem value="junio">Junio</SelectItem>
                          <SelectItem value="julio">Julio</SelectItem>
                          <SelectItem value="agosto">Agosto</SelectItem>
                          <SelectItem value="septiembre">Septiembre</SelectItem>
                          <SelectItem value="octubre">Octubre</SelectItem>
                          <SelectItem value="noviembre">Noviembre</SelectItem>
                          <SelectItem value="diciembre">Diciembre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Métricas del mes - Panel de KPIs */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Indicadores Clave del Período
                  </CardTitle>
                  <CardDescription>
                    Métricas financieras y operativas del mes seleccionado
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* KPI 1: Ingresos Netos */}
                    <Card className="border-l-4 border-l-green-500">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-green-100 rounded-lg">
                              <DollarSign className="h-5 w-5 text-green-600" />
                            </div>
                            <span className="text-sm font-medium text-muted-foreground">Ingresos Netos</span>
                          </div>
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            +12%
                          </Badge>
                        </div>
                                                 <div className="text-2xl font-bold text-foreground mb-1">
                           ${metrics.ingresos.reduce((a, b) => a + b, 0).toLocaleString()}
                         </div>
                        <div className="text-xs text-muted-foreground">
                          87% del objetivo mensual
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* KPI 2: Horas Reservadas */}
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <Clock className="h-5 w-5 text-blue-600" />
                            </div>
                            <span className="text-sm font-medium text-muted-foreground">Horas Reservadas</span>
                          </div>
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            +8%
                          </Badge>
                        </div>
                                                 <div className="text-2xl font-bold text-foreground mb-1">
                           {metrics.horas.reduce((a, b) => a + b, 0)}h
                         </div>
                        <div className="text-xs text-muted-foreground">
                          73% de ocupación mensual
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* KPI 3: Nuevos Usuarios */}
                    <Card className="border-l-4 border-l-purple-500">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-purple-100 rounded-lg">
                              <Users className="h-5 w-5 text-purple-600" />
                            </div>
                            <span className="text-sm font-medium text-muted-foreground">Nuevos Usuarios</span>
                          </div>
                          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                            +15%
                          </Badge>
                        </div>
                                                 <div className="text-2xl font-bold text-foreground mb-1">
                           {metrics.usuarios.reduce((a, b) => a + b, 0)}
                         </div>
                        <div className="text-xs text-muted-foreground">
                          67% del objetivo de crecimiento
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>

                             {/* Gráfico Interactivo de Métricas */}
               <Card>
                 <CardHeader>
                   <CardTitle className="flex items-center gap-2">
                     <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                     </svg>
                     Análisis de Métricas del Negocio
                   </CardTitle>
                   <CardDescription>
                     Visualización interactiva de las métricas clave del mes seleccionado
                   </CardDescription>
                 </CardHeader>
                 <CardContent>
                   <div className="space-y-6">
                     {/* Controles del gráfico */}
                     <div className="flex items-center gap-4">
                       <div className="flex items-center gap-2">
                         <span className="text-sm font-medium text-muted-foreground">Métrica:</span>
                         <Select value={metricType} onValueChange={(value: 'ingresos' | 'horas' | 'usuarios' | 'pagos') => setMetricType(value)}>
                           <SelectTrigger className="w-40">
                             <SelectValue placeholder="Seleccionar métrica" />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="ingresos">Ingresos ($)</SelectItem>
                             <SelectItem value="horas">Horas Reservadas</SelectItem>
                             <SelectItem value="usuarios">Nuevos Usuarios</SelectItem>
                             <SelectItem value="pagos">Estado de Pagos (%)</SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                       
                       <div className="flex items-center gap-2">
                         <span className="text-sm font-medium text-muted-foreground">Tipo:</span>
                         <div className="flex gap-1">
                           <Button
                             variant={chartType === 'bar' ? 'default' : 'outline'}
                             size="sm"
                             onClick={() => setChartType('bar')}
                           >
                             Barras
                           </Button>
                           <Button
                             variant={chartType === 'line' ? 'default' : 'outline'}
                             size="sm"
                             onClick={() => setChartType('line')}
                           >
                             Líneas
                           </Button>
                         </div>
                       </div>
                     </div>
                     
                     {/* Gráfico Interactivo */}
                     {metricsLoading ? (
                       <div className="h-80 bg-muted/50 rounded-lg border border-border flex items-center justify-center">
                         <div className="text-center">
                           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                           <p className="text-muted-foreground">Cargando métricas...</p>
                         </div>
                       </div>
                     ) : (
                       <AdminChart
                         metricType={metricType}
                         chartType={chartType}
                         data={getChartData(metricType, chartType)}
                       />
                     )}
                     
                     {/* Estadísticas del gráfico */}
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                       {metrics.labels.map((semana, index) => (
                         <Card key={semana} className="border-l-4 border-l-primary">
                           <CardContent className="p-4">
                             <div className="text-sm font-medium text-muted-foreground mb-1">{semana}</div>
                             <div className="text-lg font-bold text-foreground">
                               {metricType === 'ingresos' && `$${metrics.ingresos[index].toLocaleString()}`}
                               {metricType === 'horas' && `${metrics.horas[index]}h`}
                               {metricType === 'usuarios' && metrics.usuarios[index]}
                               {metricType === 'pagos' && `${metrics.pagos[index]}%`}
                             </div>
                             <div className="text-xs text-muted-foreground">
                               {getMetricDescription(metricType, metrics[metricType][index])}
                             </div>
                           </CardContent>
                         </Card>
                       ))}
                     </div>
                   </div>
                 </CardContent>
               </Card>

              {/* Resumen ejecutivo */}
              <Card>
                <CardHeader>
                  <CardTitle>Resumen Ejecutivo</CardTitle>
                  <CardDescription>
                    Vista general del rendimiento financiero y operativo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-foreground">Rendimiento Financiero</h4>
                      <div className="space-y-3">
                                                 <div className="flex justify-between items-center">
                           <span className="text-sm text-muted-foreground">Ingresos Totales:</span>
                           <span className="font-semibold text-green-600">${metrics.ingresos.reduce((a, b) => a + b, 0).toLocaleString()}</span>
                         </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Gastos Operativos:</span>
                          <span className="font-semibold text-red-600">$45,000</span>
                        </div>
                        <div className="flex justify-between items-center border-t pt-2">
                          <span className="text-sm font-medium text-foreground">Beneficio Neto:</span>
                          <span className="font-bold text-foreground">$85,000</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-semibold text-foreground">Métricas Operativas</h4>
                      <div className="space-y-3">
                                                 <div className="flex justify-between items-center">
                           <span className="text-sm text-muted-foreground">Ocupación Promedio:</span>
                           <span className="font-semibold text-blue-600">{Math.round((metrics.horas.reduce((a, b) => a + b, 0) / 160) * 100)}%</span>
                         </div>
                                                 <div className="flex justify-between items-center">
                           <span className="text-sm text-muted-foreground">Clientes Activos:</span>
                           <span className="font-semibold text-purple-600">{metrics.usuarios.reduce((a, b) => a + b, 0)}</span>
                         </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Satisfacción:</span>
                          <span className="font-semibold text-green-600">4.8/5.0</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab de Historial y Balance */}
          <TabsContent value="historial" className="mt-6">
            <HistorialBalance />
          </TabsContent>

          {/* Tab de Usuarios */}
          <TabsContent value="usuarios" className="mt-6">

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
