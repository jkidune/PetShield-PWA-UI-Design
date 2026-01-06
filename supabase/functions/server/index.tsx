import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Supabase client with service role for admin operations
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Auth helper to get user from token
async function getUserFromToken(authHeader: string | null) {
  if (!authHeader) return null;
  const token = authHeader.split(' ')[1];
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// Health check endpoint
app.get("/make-server-cde7550e/health", (c) => {
  return c.json({ status: "ok" });
});

// === AUTHENTICATION ROUTES ===

// Sign up new user
app.post("/make-server-cde7550e/auth/signup", async (c) => {
  try {
    const { email, password, fullName, clinicId, role } = await c.req.json();
    
    // Create user with Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name: fullName, clinic_id: clinicId, role: role || 'staff' },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.log("Auth signup error:", error);
      return c.json({ error: error.message }, 400);
    }

    // Store user profile in KV store
    await kv.set(`user:${data.user.id}`, {
      id: data.user.id,
      email: data.user.email,
      fullName,
      clinicId,
      role: role || 'staff',
      createdAt: new Date().toISOString()
    });

    return c.json({ user: data.user });
  } catch (err) {
    console.log("Error during signup:", err);
    return c.json({ error: "Signup failed" }, 500);
  }
});

// Get current user profile
app.get("/make-server-cde7550e/auth/me", async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const profile = await kv.get(`user:${user.id}`);
  return c.json({ user: profile || user });
});

// === CLINIC ROUTES ===

// Get clinic by ID
app.get("/make-server-cde7550e/clinics/:id", async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const clinicId = c.req.param('id');
  const clinic = await kv.get(`clinic:${clinicId}`);
  
  if (!clinic) {
    return c.json({ error: "Clinic not found" }, 404);
  }

  return c.json({ clinic });
});

// Update clinic profile (admin only)
app.put("/make-server-cde7550e/clinics/:id", async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const userProfile = await kv.get(`user:${user.id}`);
  if (!userProfile || userProfile.role !== 'admin') {
    return c.json({ error: "Admin access required" }, 403);
  }

  const clinicId = c.req.param('id');
  const updates = await c.req.json();

  const existingClinic = await kv.get(`clinic:${clinicId}`);
  if (!existingClinic) {
    return c.json({ error: "Clinic not found" }, 404);
  }

  const updatedClinic = { ...existingClinic, ...updates, updatedAt: new Date().toISOString() };
  await kv.set(`clinic:${clinicId}`, updatedClinic);

  return c.json({ clinic: updatedClinic });
});

// === OWNER ROUTES ===

// List owners for clinic
app.get("/make-server-cde7550e/owners", async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const userProfile = await kv.get(`user:${user.id}`);
  const clinicId = userProfile?.clinicId;

  const allOwners = await kv.getByPrefix(`owner:${clinicId}:`);
  return c.json({ owners: allOwners || [] });
});

// Create owner
app.post("/make-server-cde7550e/owners", async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const userProfile = await kv.get(`user:${user.id}`);
  const clinicId = userProfile?.clinicId;

  const ownerData = await c.req.json();
  const ownerId = `${clinicId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  const owner = {
    id: ownerId,
    clinicId,
    ...ownerData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await kv.set(`owner:${clinicId}:${ownerId}`, owner);
  return c.json({ owner });
});

// Get owner by ID
app.get("/make-server-cde7550e/owners/:id", async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const userProfile = await kv.get(`user:${user.id}`);
  const clinicId = userProfile?.clinicId;
  const ownerId = c.req.param('id');

  const owner = await kv.get(`owner:${clinicId}:${ownerId}`);
  if (!owner) {
    return c.json({ error: "Owner not found" }, 404);
  }

  return c.json({ owner });
});

// Update owner
app.put("/make-server-cde7550e/owners/:id", async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const userProfile = await kv.get(`user:${user.id}`);
  const clinicId = userProfile?.clinicId;
  const ownerId = c.req.param('id');

  const existingOwner = await kv.get(`owner:${clinicId}:${ownerId}`);
  if (!existingOwner) {
    return c.json({ error: "Owner not found" }, 404);
  }

  const updates = await c.req.json();
  const updatedOwner = { ...existingOwner, ...updates, updatedAt: new Date().toISOString() };
  await kv.set(`owner:${clinicId}:${ownerId}`, updatedOwner);

  return c.json({ owner: updatedOwner });
});

// === ANIMAL ROUTES ===

// List animals for clinic
app.get("/make-server-cde7550e/animals", async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const userProfile = await kv.get(`user:${user.id}`);
  const clinicId = userProfile?.clinicId;

  const allAnimals = await kv.getByPrefix(`animal:${clinicId}:`);
  return c.json({ animals: allAnimals || [] });
});

// Create animal
app.post("/make-server-cde7550e/animals", async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const userProfile = await kv.get(`user:${user.id}`);
  const clinicId = userProfile?.clinicId;

  const animalData = await c.req.json();
  const animalId = `${clinicId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  const animal = {
    id: animalId,
    clinicId,
    ...animalData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await kv.set(`animal:${clinicId}:${animalId}`, animal);
  return c.json({ animal });
});

// Get animal by ID
app.get("/make-server-cde7550e/animals/:id", async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const userProfile = await kv.get(`user:${user.id}`);
  const clinicId = userProfile?.clinicId;
  const animalId = c.req.param('id');

  const animal = await kv.get(`animal:${clinicId}:${animalId}`);
  if (!animal) {
    return c.json({ error: "Animal not found" }, 404);
  }

  return c.json({ animal });
});

// Update animal
app.put("/make-server-cde7550e/animals/:id", async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const userProfile = await kv.get(`user:${user.id}`);
  const clinicId = userProfile?.clinicId;
  const animalId = c.req.param('id');

  const existingAnimal = await kv.get(`animal:${clinicId}:${animalId}`);
  if (!existingAnimal) {
    return c.json({ error: "Animal not found" }, 404);
  }

  const updates = await c.req.json();
  const updatedAnimal = { ...existingAnimal, ...updates, updatedAt: new Date().toISOString() };
  await kv.set(`animal:${clinicId}:${animalId}`, updatedAnimal);

  return c.json({ animal: updatedAnimal });
});

// === VACCINATION ROUTES ===

// Get vaccination plans for an animal
app.get("/make-server-cde7550e/animals/:animalId/vaccination-plans", async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const userProfile = await kv.get(`user:${user.id}`);
  const clinicId = userProfile?.clinicId;
  const animalId = c.req.param('animalId');

  const plans = await kv.getByPrefix(`vaccination-plan:${clinicId}:${animalId}:`);
  return c.json({ plans: plans || [] });
});

// Create vaccination plan
app.post("/make-server-cde7550e/vaccination-plans", async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const userProfile = await kv.get(`user:${user.id}`);
  const clinicId = userProfile?.clinicId;

  const planData = await c.req.json();
  const planId = `${clinicId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  const plan = {
    id: planId,
    clinicId,
    ...planData,
    createdAt: new Date().toISOString()
  };

  await kv.set(`vaccination-plan:${clinicId}:${planData.animalId}:${planId}`, plan);
  return c.json({ plan });
});

// Log vaccination
app.post("/make-server-cde7550e/vaccinations/log", async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const userProfile = await kv.get(`user:${user.id}`);
  const clinicId = userProfile?.clinicId;

  const logData = await c.req.json();
  const logId = `${clinicId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  const vaccinationLog = {
    id: logId,
    clinicId,
    ...logData,
    points: 5, // Award 5 points per vaccination
    loggedAt: new Date().toISOString()
  };

  await kv.set(`vaccination-log:${clinicId}:${logId}`, vaccinationLog);

  // Update owner points
  const ownerId = logData.ownerId;
  const pointsKey = `points:${clinicId}:${ownerId}`;
  const currentPoints = await kv.get(pointsKey) || { total: 0, earned: 0, redeemed: 0 };
  const updatedPoints = {
    total: currentPoints.total + 5,
    earned: currentPoints.earned + 5,
    redeemed: currentPoints.redeemed
  };
  await kv.set(pointsKey, updatedPoints);

  return c.json({ vaccination: vaccinationLog, pointsAwarded: 5 });
});

// Get vaccination logs for clinic
app.get("/make-server-cde7550e/vaccinations", async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const userProfile = await kv.get(`user:${user.id}`);
  const clinicId = userProfile?.clinicId;

  const logs = await kv.getByPrefix(`vaccination-log:${clinicId}:`);
  return c.json({ vaccinations: logs || [] });
});

// === MESSAGES ROUTES ===

// Send message
app.post("/make-server-cde7550e/messages/send", async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const userProfile = await kv.get(`user:${user.id}`);
  const clinicId = userProfile?.clinicId;

  const messageData = await c.req.json();
  const messageId = `${clinicId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  const message = {
    id: messageId,
    clinicId,
    ...messageData,
    sentAt: new Date().toISOString(),
    status: 'pending' // In real implementation, this would integrate with WhatsApp/SMS/Email APIs
  };

  await kv.set(`message:${clinicId}:${messageId}`, message);
  return c.json({ message });
});

// Get messages for clinic
app.get("/make-server-cde7550e/messages", async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const userProfile = await kv.get(`user:${user.id}`);
  const clinicId = userProfile?.clinicId;

  const messages = await kv.getByPrefix(`message:${clinicId}:`);
  return c.json({ messages: messages || [] });
});

// === USERS/STAFF ROUTES (Admin only) ===

// Get users for clinic
app.get("/make-server-cde7550e/users", async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const userProfile = await kv.get(`user:${user.id}`);
  if (!userProfile || userProfile.role !== 'admin') {
    return c.json({ error: "Admin access required" }, 403);
  }

  const clinicId = userProfile.clinicId;
  const allUsers = await kv.getByPrefix(`user:`);
  const clinicUsers = allUsers.filter((u: any) => u.clinicId === clinicId);

  return c.json({ users: clinicUsers });
});

// === DASHBOARD / REPORTS ===

// Get dashboard stats
app.get("/make-server-cde7550e/dashboard/stats", async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const userProfile = await kv.get(`user:${user.id}`);
  const clinicId = userProfile?.clinicId;

  // Get all data for clinic
  const animals = await kv.getByPrefix(`animal:${clinicId}:`);
  const owners = await kv.getByPrefix(`owner:${clinicId}:`);
  const vaccinations = await kv.getByPrefix(`vaccination-log:${clinicId}:`);
  const plans = await kv.getByPrefix(`vaccination-plan:${clinicId}:`);

  // Calculate stats
  const stats = {
    totalAnimals: animals.length,
    totalOwners: owners.length,
    thisMonthVaccinations: vaccinations.filter((v: any) => {
      const logDate = new Date(v.loggedAt);
      const now = new Date();
      return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
    }).length,
    upcomingVaccinations: plans.filter((p: any) => {
      if (p.status === 'completed') return false;
      const dueDate = new Date(p.nextDueDate || p.dueDate);
      const now = new Date();
      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
      return diffDays >= 0 && diffDays <= 7;
    }).length
  };

  return c.json({ stats });
});

// === OFFLINE SYNC ===

// Sync offline changes
app.post("/make-server-cde7550e/sync", async (c) => {
  const user = await getUserFromToken(c.req.header('Authorization'));
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const userProfile = await kv.get(`user:${user.id}`);
  const clinicId = userProfile?.clinicId;

  const { changes } = await c.req.json();
  const synced = [];
  const conflicts = [];

  for (const change of changes) {
    try {
      const { type, entity, data, localId, timestamp } = change;
      
      // Check for conflicts
      if (data.id) {
        const existing = await kv.get(`${type}:${clinicId}:${data.id}`);
        if (existing && existing.updatedAt && existing.updatedAt > timestamp) {
          conflicts.push({ localId, existing, incoming: data });
          continue;
        }
      }

      // Apply change
      const id = data.id || `${clinicId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      await kv.set(`${type}:${clinicId}:${id}`, { ...data, id, clinicId });
      synced.push({ localId, id });
    } catch (error) {
      console.log("Sync error for change:", change, error);
    }
  }

  return c.json({ synced, conflicts });
});

Deno.serve(app.fetch);
