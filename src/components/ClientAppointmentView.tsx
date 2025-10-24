import { useState, useMemo } from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock, User, Phone, ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, isSameDay, isToday, isBefore, startOfDay, addMonths, getDate } from "date-fns";
import { es } from "date-fns/locale";

interface Professional {
  name: string;
  specialty: string;
  workingHours: { start: string; end: string };
  appointmentDuration: number;
  availableDays: number[];
}

interface Appointment {
  id: string;
  date: Date;
  time: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  notes?: string;
}

interface ClientAppointmentViewProps {
  professional: Professional;
}

export const ClientAppointmentView = ({ professional }: ClientAppointmentViewProps) => {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingData, setBookingData] = useState({
    name: "",
    phone: "",
    email: ""
  });

  // Mock appointments data
  const [appointments, setAppointments] = useState<Appointment[]>([
    {
      id: "1",
      date: new Date(),
      time: "10:00",
      clientName: "Juan Pérez",
      clientPhone: "+54 11 1234-5678",
      clientEmail: "juan@email.com",
      status: "confirmed",
      notes: "Primera consulta"
    },
    {
      id: "2",
      date: addDays(new Date(), 1),
      time: "14:30",
      clientName: "María García",
      clientPhone: "+54 11 8765-4321",
      status: "pending"
    }
  ]);

  // Generate time slots for the selected date
  const timeSlots = useMemo(() => {
    const slots = [];
    const [startHour, startMinute] = professional.workingHours.start.split(':').map(Number);
    const [endHour, endMinute] = professional.workingHours.end.split(':').map(Number);
    
    let currentTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;
    
    while (currentTime < endTime) {
      const hours = Math.floor(currentTime / 60);
      const minutes = currentTime % 60;
      const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      
      const existingAppointment = appointments.find(
        apt => isSameDay(apt.date, selectedDate) && apt.time === timeString
      );
      
      slots.push({
        time: timeString,
        available: !existingAppointment,
        appointment: existingAppointment
      });
      
      currentTime += professional.appointmentDuration;
    }
    
    return slots;
  }, [selectedDate, professional, appointments]);

  // Generate calendar grid for the month
  const monthDays = useMemo(() => {
    const monthStart = currentMonth;
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = startOfWeek(addDays(monthEnd, 6), { weekStartsOn: 1 });
    
    const days = [];
    let currentDate = startDate;
    
    while (currentDate <= endDate) {
      days.push(currentDate);
      currentDate = addDays(currentDate, 1);
    }
    
    return days;
  }, [currentMonth]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => addMonths(prev, direction === 'next' ? 1 : -1));
  };

  const isDateAvailable = (date: Date) => {
    const dayOfWeek = date.getDay();
    const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert Sunday from 0 to 7
    return professional.availableDays.includes(adjustedDay) && !isBefore(date, startOfDay(new Date()));
  };

  const handleTimeSlotSelect = (time: string) => {
    setSelectedTime(time);
    setShowBookingForm(true);
  };

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTime || !bookingData.name || !bookingData.phone) return;

    const newAppointment: Appointment = {
      id: Date.now().toString(),
      date: selectedDate,
      time: selectedTime,
      clientName: bookingData.name,
      clientPhone: bookingData.phone,
      clientEmail: bookingData.email,
      status: 'pending'
    };

    setAppointments(prev => [...prev, newAppointment]);
    setShowBookingForm(false);
    setSelectedTime(null);
    setBookingData({ name: "", phone: "", email: "" });
  };

  const handleBackToCalendar = () => {
    setShowBookingForm(false);
    setSelectedTime(null);
    setBookingData({ name: "", phone: "", email: "" });
  };

  if (showBookingForm) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="bg-card border-b shadow-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToCalendar}
                  className="p-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="w-8 h-8">
                  <img src="/maldagym1.png" alt="Logo Malda Gym" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">Reservar Turno</h1>
                  <p className="text-sm text-muted-foreground">
                    {format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })} - {selectedTime}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Booking Form */}
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Datos del Paciente</span>
              </CardTitle>
              <CardDescription>
                Complete sus datos para confirmar la reserva del turno
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBookingSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nombre completo *</Label>
                    <Input
                      id="name"
                      value={bookingData.name}
                      onChange={(e) => setBookingData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ingrese su nombre completo"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="phone">Teléfono *</Label>
                    <Input
                      id="phone"
                      value={bookingData.phone}
                      onChange={(e) => setBookingData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+54 11 1234-5678"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email (opcional)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={bookingData.email}
                      onChange={(e) => setBookingData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="su@email.com"
                    />
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-sm">Resumen de la reserva:</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><strong>Profesional:</strong> {professional.name}</p>
                    <p><strong>Especialidad:</strong> {professional.specialty}</p>
                    <p><strong>Fecha:</strong> {format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}</p>
                    <p><strong>Horario:</strong> {selectedTime}</p>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBackToCalendar}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-primary hover:bg-gradient-primary/90"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Confirmar Reserva
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b shadow-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8">
                <img src="/maldagym1.png" alt="Logo Malda Gym" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Turnos Disponibles</h1>
                <p className="text-sm text-muted-foreground">Seleccione un turno libre</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{professional.name}</p>
                <p className="text-xs text-muted-foreground">{professional.specialty}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">


          {/* Time Slots */}
          <div>
            <Card className="shadow-card">
                             <CardHeader>
                 <CardTitle className="flex items-center space-x-2">
                   <Clock className="h-5 w-5" />
                   <span>Horarios Disponibles</span>
                 </CardTitle>
               </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {timeSlots.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No hay horarios disponibles para este día</p>
                    </div>
                  ) : (
                    timeSlots.map((slot) => (
                      <Button
                        key={slot.time}
                        variant={slot.available ? "outline" : "ghost"}
                        className={`
                          w-full justify-start h-auto p-3
                          ${slot.available 
                            ? 'hover:bg-primary/10 hover:border-primary/50' 
                            : 'opacity-50 cursor-not-allowed'
                          }
                        `}
                        disabled={!slot.available}
                        onClick={() => slot.available && handleTimeSlotSelect(slot.time)}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4" />
                            <span className="font-medium">{slot.time}</span>
                          </div>
                          <Badge variant={slot.available ? "default" : "secondary"}>
                            {slot.available ? "Disponible" : "Ocupado"}
                          </Badge>
                        </div>
                      </Button>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}; 