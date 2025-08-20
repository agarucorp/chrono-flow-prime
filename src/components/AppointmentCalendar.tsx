import { useState, useMemo } from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock, User, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, addDays, startOfWeek, isSameDay, isToday, isBefore, startOfDay } from "date-fns";
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

interface AppointmentCalendarProps {
  professional: Professional;
}

export const AppointmentCalendar = ({ professional }: AppointmentCalendarProps) => {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDate, setSelectedDate] = useState(new Date());
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

  // Get week days
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));
  }, [currentWeek]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(prev => addDays(prev, direction === 'next' ? 7 : -7));
  };

  const isDateAvailable = (date: Date) => {
    const dayOfWeek = date.getDay();
    const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert Sunday from 0 to 7
    return professional.availableDays.includes(adjustedDay) && !isBefore(date, startOfDay(new Date()));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-500/10 text-green-700 border-green-200';
      case 'pending': return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
      case 'cancelled': return 'bg-red-500/10 text-red-700 border-red-200';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Week View */}
        <div className="lg:col-span-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Vista Semanal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2 mb-4">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day, index) => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((date, index) => {
                  const dayAppointments = appointments.filter(apt => isSameDay(apt.date, date));
                  const isAvailable = isDateAvailable(date);
                  const isSelected = isSameDay(date, selectedDate);
                  const isCurrentDay = isToday(date);
                  
                  return (
                    <Button
                      key={index}
                      variant={isSelected ? "default" : "outline"}
                      className={`
                        h-20 p-2 flex flex-col justify-start items-center relative transition-all duration-200
                        ${!isAvailable ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}
                        ${isCurrentDay ? 'ring-2 ring-primary/50' : ''}
                        ${isSelected ? 'shadow-md' : ''}
                      `}
                      onClick={() => isAvailable && setSelectedDate(date)}
                      disabled={!isAvailable}
                    >
                      <span className={`text-lg font-semibold ${isCurrentDay ? 'text-primary' : ''}`}>
                        {format(date, 'd')}
                      </span>
                      {dayAppointments.length > 0 && (
                        <Badge 
                          variant="secondary" 
                          className="absolute bottom-1 text-xs px-1 min-w-[20px] h-4"
                        >
                          {dayAppointments.length}
                        </Badge>
                      )}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>


      </div>
    </div>
  );
};