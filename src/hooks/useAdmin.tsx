import { useState, useEffect, useCallback } from 'react'; // Agregado useCallback
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';

export interface AdminUser {
  id: string;
  email: string;
  isAdmin: boolean;
  role: string;
  metadata?: any;
}

export const useAdmin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) {
      setIsAdmin(false);
      setAdminUser(null);
      setLoading(false);
      return;
    }

    try {
      const { data: userData, error } = await supabase
        .from('usuario')
        .select('*')
        .eq('email', user.email)
        .single();

      if (error) {
        console.log('Usuario no encontrado en tabla usuario, creando entrada...');
        const { data: newUser, error: createError } = await supabase
          .from('usuario')
          .insert({
            nombre: user.email?.split('@')[0] || 'Usuario',
            email: user.email,
            nivel: 1,
            rol: 'jugador' // <-- CORREGIDO
          })
          .select()
          .single();

        if (!createError && newUser) {
          setIsAdmin(false);
          setAdminUser({
            id: user.id,
            email: user.email || '',
            isAdmin: false,
            role: 'jugador',
          });
        }
      } else {
        const userIsAdmin = userData.rol === 'admin';
        setIsAdmin(userIsAdmin);
        setAdminUser({
          id: user.id,
          email: user.email || '',
          isAdmin: userIsAdmin,
          role: userData.rol,
          metadata: userData,
        });
      }
    } catch (error: any) {
      console.error('Error verificando status de admin:', error);
      setIsAdmin(false);
      setAdminUser(null);
    } finally {
      setLoading(false);
    }
  };

  const promoteToAdmin = useCallback(async (userEmail: string) => {
    if (!isAdmin) throw new Error('No tienes permisos de administrador');
    
    const { error } = await supabase
      .from('usuario')
      .update({ rol: 'admin' })
      .eq('email', userEmail);
    
    if (error) throw error;
    return true;
  }, [isAdmin]);

  const revokeAdmin = useCallback(async (userEmail: string) => {
    if (!isAdmin) throw new Error('No tienes permisos de administrador');

    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (currentUser?.email === userEmail) {
      throw new Error("No puedes revocar tus propios permisos de administrador.");
    }

    const { error } = await supabase
      .from('usuario')
      .update({ rol: 'jugador' }) // <-- CORREGIDO
      .eq('email', userEmail);
    
    if (error) throw error;
    return true;
  }, [isAdmin]);

  return {
    isAdmin,
    adminUser,
    loading,
    checkAdminStatus,
    promoteToAdmin,
    revokeAdmin
  };
};

export default useAdmin;