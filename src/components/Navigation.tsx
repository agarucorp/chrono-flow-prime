import React from 'react'
import { useAuthContext } from '../contexts/AuthContext'
import { Button } from './ui/button'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu'
import { 
  LogOut, 
  User, 
  Crown, 
  Shield,
  Wallet,
  HelpCircle
} from 'lucide-react';
import { useAdmin } from '@/hooks/useAdmin'
import { useNavigate } from 'react-router-dom'

export const Navigation: React.FC = () => {
  const { user, signOut } = useAuthContext()
  const { isAdmin } = useAdmin()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
  }

  const getUserInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase()
  }

  if (!user) {
    return null
  }

  return (
    <nav className="border-b border-border bg-background shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 relative">
          <div className="w-32 h-12">
            {isAdmin && (
              <div className="flex items-center h-full">
                <span className="text-lg font-medium text-muted-foreground">Admin panel</span>
              </div>
            )}
          </div>

          <div className="absolute left-1/2 transform -translate-x-1/2">
            <div className="w-32 h-12">
              <img src="/letrasgym.png" alt="Logo Letras Gym" className="w-full h-full object-contain" />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Botón de soporte (reemplaza avatar) */}
            <button
              type="button"
              aria-label="Soporte"
              className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-border hover:bg-muted transition-colors"
              onClick={() => window.dispatchEvent(new CustomEvent('soporte:open'))}
            >
              <HelpCircle className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
