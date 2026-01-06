import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

export const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-cde7550e`;

// API helper with auth
export async function apiCall(endpoint: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers = {
    'Content-Type': 'application/json',
    ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      return handleMockRequest(endpoint, options);
    }

    return response.json();
  } catch (error) {
    console.warn(`Network request to ${endpoint} failed, using local mock.`);
    return handleMockRequest(endpoint, options);
  }
}

// Mock Backend Implementation
async function handleMockRequest(endpoint: string, options: RequestInit) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body as string) : null;

  // Dashboard Stats
  if (endpoint === '/dashboard/stats' && method === 'GET') {
    const owners = getLocalData('owners');
    const animals = getLocalData('animals');
    const logs = getLocalData('vaccination_logs');
    const plans = getLocalData('vaccination_plans');
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thisMonthVaccinations = logs.filter((l: any) => {
      const d = new Date(l.date || l.loggedAt);
      return d >= startOfMonth && d <= endOfMonth;
    }).length;
    const upcomingVaccinations = plans.filter((p: any) => {
      const d = new Date(p.nextDate);
      return d >= now && d <= sevenDaysFromNow;
    }).length;
    return {
      stats: {
        totalAnimals: animals.length,
        totalOwners: owners.length,
        thisMonthVaccinations,
        upcomingVaccinations
      }
    };
  }

  // Owners
  if (endpoint.startsWith('/owners')) {
    if (method === 'GET') {
      return { users: getLocalData('owners') };
    }
    if (method === 'POST') {
      const owners = getLocalData('owners');
      const newOwner = { 
        id: crypto.randomUUID(), 
        ...body, 
        createdAt: new Date().toISOString() 
      };
      owners.push(newOwner);
      setLocalData('owners', owners);
      return { user: newOwner };
    }
    if (method === 'PUT') {
      const owners = getLocalData('owners');
      // Extract ID from endpoint: /owners/ID
      const id = endpoint.split('/').pop();
      const index = owners.findIndex((o: any) => o.id === id);
      if (index !== -1) {
        owners[index] = { ...owners[index], ...body, updatedAt: new Date().toISOString() };
        setLocalData('owners', owners);
        return { user: owners[index] };
      }
      throw new Error('Owner not found');
    }
  }

  // Animals
  if (endpoint.startsWith('/animals')) {
    if (method === 'GET') {
      return { animals: getLocalData('animals') };
    }
    if (method === 'POST') {
      const animals = getLocalData('animals');
      const newAnimal = { 
        id: crypto.randomUUID(), 
        ...body, 
        createdAt: new Date().toISOString() 
      };
      animals.push(newAnimal);
      setLocalData('animals', animals);
      return { animal: newAnimal };
    }
    if (method === 'PUT') {
      const animals = getLocalData('animals');
      // Extract ID from endpoint: /animals/ID
      const id = endpoint.split('/').pop();
      const index = animals.findIndex((a: any) => a.id === id);
      if (index !== -1) {
        animals[index] = { ...animals[index], ...body, updatedAt: new Date().toISOString() };
        setLocalData('animals', animals);
        return { animal: animals[index] };
      }
      throw new Error('Animal not found');
    }
  }

  // Vaccination Plans
  if (endpoint === '/vaccination-plan') {
    if (method === 'GET') {
      return { plans: getLocalData('vaccination_plans') };
    }
    if (method === 'POST') {
      const plans = getLocalData('vaccination_plans');
      const newPlan = {
        id: crypto.randomUUID(),
        animalId: body.animalId,
        vaccineName: body.vaccineName,
        intervalDays: Number(body.intervalDays) || 0,
        nextDate: body.nextDate,
        notes: body.notes || '',
        createdAt: new Date().toISOString(),
      };
      plans.push(newPlan);
      setLocalData('vaccination_plans', plans);
      return { plan: newPlan };
    }
  }

  // Vaccination Logs
  if (endpoint === '/vaccination-log') {
    if (method === 'GET') {
      return { logs: getLocalData('vaccination_logs') };
    }
    if (method === 'POST') {
      const logs = getLocalData('vaccination_logs');
      const newLog = {
        id: crypto.randomUUID(),
        animalId: body.animalId,
        vaccineName: body.vaccineName,
        date: body.date,
        notes: body.notes || '',
        createdAt: new Date().toISOString(),
      };
      logs.push(newLog);
      setLocalData('vaccination_logs', logs);
      return { log: newLog };
    }
  }

  // Auth Me (Mock Profile)
  if (endpoint === '/auth/me') {
    return {
      user: {
        id: 'mock-user-id',
        email: 'demo@petshield.app',
        fullName: 'Demo User',
        clinicId: 'demo-clinic',
        role: 'admin'
      }
    };
  }

  // Clinics
  if (endpoint.startsWith('/clinics/')) {
    if (method === 'GET') {
      return {
        clinic: {
          id: 'demo-clinic',
          name: 'PetShield Demo Clinic',
          address: '123 Vet Street',
          phone: '555-0123',
          email: 'clinic@petshield.app'
        }
      };
    }
  }

  throw new Error(`Mock endpoint not found: ${method} ${endpoint}`);
}

// Local Storage Helpers
function getLocalData(key: string) {
  try {
    const data = localStorage.getItem(`petshield_${key}`);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function setLocalData(key: string, data: any) {
  localStorage.setItem(`petshield_${key}`, JSON.stringify(data));
}

export async function isServerAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}
