🏗️ Architecture RBAC Pragmatique - EMG C3D Analyzer

  ## 1. Architecture Système à 3 Niveaux (KISS + Secure)

  ┌─────────────────────────────────────────────────────────────────────┐
  │                          SUPABASE (PostgreSQL)                        │
  ├─────────────────────────────────────────────────────────────────────┤
  │  • auth.users (Supabase Auth natif)                                  │
  │  • user_profiles (table existante avec role)                         │
  │  • RLS Policies (sécurité database-level) ← PRIORITÉ                 │
  │  • Audit triggers (logging automatique)                              │
  └─────────────────────────────────────────────────────────────────────┘
                                      ↕
  ┌─────────────────────────────────────────────────────────────────────┐
  │                         FASTAPI BACKEND                               │
  ├─────────────────────────────────────────────────────────────────────┤
  │  • JWT avec role intégré (Supabase natif)                            │
  │  • Simple role checker (3 rôles fixes)                               │
  │  • Permissions hardcodées (pas de DB)                                │
  │  • Audit via middleware léger                                        │
  └─────────────────────────────────────────────────────────────────────┘
                                      ↕
  ┌─────────────────────────────────────────────────────────────────────┐
  │                           REACT FRONTEND                              │
  ├─────────────────────────────────────────────────────────────────────┤
  │  • AuthContext enrichi (pas de nouveau Context)                      │
  │  • Role-based routing simple                                          │
  │  • Conditional rendering basique                                      │
  │  • 3 dashboards minimalistes                                          │
  └─────────────────────────────────────────────────────────────────────┘

  ## 2. Hiérarchie des Rôles (Simple et Claire)

  ```typescript
  enum UserRole {
    ADMIN = 'admin',          // Gestion clinique et configuration
    THERAPIST = 'therapist',  // Gestion patients et sessions
    RESEARCHER = 'researcher' // Analyse données anonymisées
  }
  ```

  ## 3. Matrice de Permissions Simplifiée (Phase Trial vs Production)

  ### Phase Trial (Recherche Clinique)
  | Action                   | Admin       | Therapist          | Researcher   |
  |-------------------------|-------------|--------------------|--------------|
  | Upload C3D              | ❌          | ✅ Own patients    | ❌           |
  | View Sessions           | ✅ All      | ✅ Own patients    | ✅ Anonymisé  |
  | Add Session Notes       | ❌          | ✅                 | ❌           |
  | Modify Data             | ❌          | ❌                 | ❌           |
  | Export Data             | ✅          | ❌                 | ✅ Bulk      |
  | Configure Scoring       | ✅          | ❌                 | ❌           |

  ### Phase Production (Usage Clinique)
  | Action                   | Admin       | Therapist          | Researcher   |
  |-------------------------|-------------|--------------------|--------------|
  | CRUD Patients           | ❌          | ✅ Own             | ❌           |
  | CRUD Sessions           | ❌          | ✅ Own             | ❌           |
  | Configure Scoring       | ✅          | ✅ Per patient     | ❌           |
  | System Settings         | ✅          | ❌                 | ❌           |
  | View Analytics          | ✅ All      | ✅ Own             | ✅ Aggregé   |

  ## 4. Implémentation Supabase (KISS + Secure)

  ### A. Utilisation des Tables Existantes

  ```sql
  -- ✅ La table user_profiles existe déjà avec:
  -- • role (enum: ADMIN, THERAPIST, RESEARCHER)
  -- • Pas besoin de tables supplémentaires
  
  -- ✅ La relation therapist-patient existe dans:
  -- • table patients avec therapist_id
  -- • Pas besoin de table de jointure
  
  -- Audit trail simple
  CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id),
    user_role TEXT,
    action TEXT,
    table_name TEXT,
    record_id UUID,
    changes JSONB
  );
  ```

  ### B. RLS Policies Simplifiées (Priorité Absolue)

  ```sql
  -- Enable RLS sur toutes les tables
  ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
  ALTER TABLE therapy_sessions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE scoring_configuration ENABLE ROW LEVEL SECURITY;

  -- Policy 1: Admin voit tout (avec audit automatique)
  CREATE POLICY admin_full_access ON ALL TABLES
  FOR ALL USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'ADMIN'
  );

  -- Policy 2: Therapist voit/modifie ses patients
  CREATE POLICY therapist_own_patients ON patients
  FOR ALL USING (
    therapist_id = auth.uid()
  );

  CREATE POLICY therapist_own_sessions ON therapy_sessions
  FOR ALL USING (
    patient_id IN (
      SELECT id FROM patients WHERE therapist_id = auth.uid()
    )
  );

  -- Policy 3: Researcher read-only (données anonymisées via VIEW)
  CREATE POLICY researcher_read_only ON therapy_sessions
  FOR SELECT USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'RESEARCHER'
  );

  -- Vue anonymisée pour les researchers
  CREATE VIEW anonymized_sessions AS
  SELECT 
    id,
    session_date,
    -- Pas de patient_id ou therapist_id
    mvc_value,
    game_score,
    compliance_metrics
  FROM therapy_sessions;
  ```

  ## 5. Implémentation FastAPI (Pragmatique)

  ### A. Utiliser Supabase JWT Natif

  ```python
  # backend/services/auth_service.py
  # ✅ Supabase gère déjà les JWT avec rôle intégré
  
  from supabase import Client
  from functools import wraps
  
  def get_current_user_role(supabase: Client, token: str):
      """Extrait le rôle depuis le JWT Supabase"""
      user = supabase.auth.get_user(token)
      if user:
          # Le rôle vient de user_profiles
          profile = supabase.table('user_profiles').select('role').eq('id', user.id).single().execute()
          return profile.data['role'] if profile.data else None
      return None
  ```

  ### B. Simple Role Checker (KISS)

  ```python
  # backend/api/dependencies.py
  from fastapi import Depends, HTTPException, Header
  from typing import Optional
  
  # Permissions hardcodées pour 3 rôles (pas de DB)
  PERMISSIONS = {
      'ADMIN': ['scoring:write', 'settings:write', 'reports:all'],
      'THERAPIST': ['patients:write', 'sessions:write', 'reports:own'],
      'RESEARCHER': ['reports:read', 'analytics:read']
  }
  
  def check_permission(required: str):
      """Décorateur simple pour vérifier les permissions"""
      def decorator(func):
          @wraps(func)
          async def wrapper(*args, **kwargs):
              # Le rôle vient du header Authorization
              token = kwargs.get('authorization')
              role = get_current_user_role(supabase, token)
              
              if required not in PERMISSIONS.get(role, []):
                  raise HTTPException(403, "Permission denied")
              
              return await func(*args, **kwargs)
          return wrapper
      return decorator
  
  # Usage simple
  @router.put("/scoring/configuration")
  @check_permission("scoring:write")
  async def update_scoring_config(config: ScoringConfig):
      # Seuls les ADMIN arrivent ici
      pass
  ```

  ### C. Audit Middleware Léger

  ```python
  # backend/middleware/audit.py
  from fastapi import Request
  import json
  from datetime import datetime
  
  async def audit_middleware(request: Request, call_next):
      """Log les écritures pour compliance"""
      if request.method in ["POST", "PUT", "DELETE"]:
          # Log basique dans la DB
          body = await request.body()
          audit_entry = {
              "timestamp": datetime.utcnow(),
              "user_id": request.headers.get("user-id"),
              "method": request.method,
              "path": request.url.path,
              "body": json.loads(body) if body else None
          }
          # Enregistrer dans audit_log via Supabase
          await log_to_audit(audit_entry)
      
      response = await call_next(request)
      return response
  ```

  ## 6. Implémentation React (Minimaliste)

  ### A. AuthContext Enrichi (Pas de nouveau Context!)

  ```typescript
  // frontend/src/contexts/AuthContext.tsx
  // ✅ Enrichir l'existant au lieu de créer un nouveau Context
  
  interface AuthContextType {
    authState: AuthState
    login: (credentials: LoginCredentials) => Promise<AuthResponse<Session>>
    logout: () => Promise<AuthResponse<void>>
    // ... existing methods ...
    
    // 🆕 Ajouts RBAC simples
    userRole: 'admin' | 'therapist' | 'researcher' | null
    canAccess: (permission: string) => boolean
  }
  
  // Dans AuthProvider, ajouter:
  const userRole = authState.profile?.role || null;
  
  const canAccess = useCallback((permission: string) => {
    const permissions = {
      'admin': ['all'],
      'therapist': ['patients', 'sessions', 'own-reports'],
      'researcher': ['analytics', 'anonymized-data']
    };
    
    if (!userRole) return false;
    if (userRole === 'admin') return true; // Admin peut tout
    return permissions[userRole]?.includes(permission) || false;
  }, [userRole]);
  ```

  ### B. Routing Basé sur le Rôle

  ```tsx
  // frontend/src/App.tsx
  import { Navigate } from 'react-router-dom';
  import { useAuth } from './contexts/AuthContext';
  
  // 3 Dashboards minimalistes
  const AdminDashboard = lazy(() => import('./dashboards/AdminDashboard'));
  const TherapistDashboard = lazy(() => import('./dashboards/TherapistDashboard'));
  const ResearcherDashboard = lazy(() => import('./dashboards/ResearcherDashboard'));
  
  function App() {
    const { isAuthenticated, userRole } = useAuth();
    
    // Redirection après login basée sur le rôle
    const getDashboard = () => {
      if (!isAuthenticated) return <LoginPage />;
      
      switch(userRole) {
        case 'admin':
          return <AdminDashboard />;
        case 'therapist':
          return <TherapistDashboard />;
        case 'researcher':
          return <ResearcherDashboard />;
        default:
          return <Navigate to="/login" />;
      }
    };
    
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard/*" element={getDashboard()} />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    );
  }
  ```

  ### C. Conditional Rendering Simple

  ```tsx
  // frontend/src/components/settings/ScoringWeightsSettings.tsx
  import { useAuth } from '../../contexts/AuthContext';
  
  export function ScoringWeightsSettings() {
    const { userRole } = useAuth();
    const isAdmin = userRole === 'admin';
    const isTherapist = userRole === 'therapist';
    
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            Scoring Configuration
            {!isAdmin && <Badge variant="outline">Read Only</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Slider
            value={[weights.compliance * 100]}
            onValueChange={isAdmin ? updateWeight : undefined}
            disabled={!isAdmin}
            className={!isAdmin ? "opacity-50" : ""}
          />
          
          {isTherapist && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Contact admin to modify scoring weights
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }
  ```

  ### D. Les 3 Dashboards Minimalistes

  ```tsx
  // frontend/src/dashboards/AdminDashboard.tsx
  export function AdminDashboard() {
    return (
      <div className="p-6">
        <h1>Admin Dashboard</h1>
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardTitle>⚙️ System Settings</CardTitle>
            <ScoringWeightsSettings />
          </Card>
          <Card>
            <CardTitle>👥 User Management</CardTitle>
            <UserList />
          </Card>
          <Card>
            <CardTitle>📊 Site Statistics</CardTitle>
            <GlobalMetrics />
          </Card>
          <Card>
            <CardTitle>🔍 Audit Logs</CardTitle>
            <AuditTrail />
          </Card>
        </div>
      </div>
    );
  }
  
  // frontend/src/dashboards/TherapistDashboard.tsx
  export function TherapistDashboard() {
    return (
      <div className="p-6">
        <h1>Therapist Dashboard</h1>
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardTitle>👥 My Patients</CardTitle>
            <PatientList ownOnly={true} />
          </Card>
          <Card>
            <CardTitle>📈 Session Results</CardTitle>
            <SessionMetrics patientFilter="own" />
          </Card>
          <Card>
            <CardTitle>📝 Clinical Notes</CardTitle>
            <NotesEditor />
          </Card>
          <Card>
            <CardTitle>📤 Upload C3D</CardTitle>
            <C3DUploader />
          </Card>
        </div>
      </div>
    );
  }
  
  // frontend/src/dashboards/ResearcherDashboard.tsx  
  export function ResearcherDashboard() {
    return (
      <div className="p-6">
        <h1>Researcher Dashboard</h1>
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardTitle>📊 Study Analytics</CardTitle>
            <PopulationMetrics anonymized={true} />
          </Card>
          <Card>
            <CardTitle>📈 Statistical Analysis</CardTitle>
            <ResearchCharts />
          </Card>
          <Card>
            <CardTitle>📑 Export Center</CardTitle>
            <DataExporter anonymized={true} />
          </Card>
          <Card>
            <CardTitle>🔍 Trends</CardTitle>
            <TrendAnalysis />
          </Card>
        </div>
      </div>
    );
  }
  ```

  ## 7. Checklist d'Implémentation Pragmatique

  ### ✅ Phase 1: Foundation (Jour 1)
  - [ ] Git: Créer branche `feature/rbac-implementation`
  - [ ] DB: Activer RLS sur les tables principales
  - [ ] DB: Créer les policies RLS simples
  - [ ] DB: Créer table audit_log
  - [ ] Backend: Ajouter role checker simple
  
  ### ✅ Phase 2: Integration (Jour 2)
  - [ ] Frontend: Enrichir AuthContext avec role
  - [ ] Frontend: Modifier authService → user_profiles
  - [ ] Frontend: Créer 3 dashboards minimalistes
  - [ ] Frontend: Implémenter routing par rôle
  - [ ] Backend: Tests RBAC basiques
  
  ### ✅ Phase 3: Polish (Jour 3)
  - [ ] UI: Fix z-index issues
  - [ ] UI: Conditional rendering sur settings
  - [ ] Tests: E2E pour chaque rôle
  - [ ] Docs: Update API documentation
  - [ ] Deploy: Test en staging

  ## 8. Principes KISS Appliqués

  1. **Pas de sur-ingénierie**: 
     - ❌ Pas de table permissions (3 rôles fixes)
     - ❌ Pas de RoleContext séparé
     - ✅ Utiliser l'existant (user_profiles, AuthContext)
  
  2. **Sécurité par défaut**:
     - ✅ RLS dès le début (database-level)
     - ✅ Audit automatique via triggers
     - ✅ JWT Supabase natif
  
  3. **Pragmatisme**:
     - ✅ Permissions hardcodées (pas de DB)
     - ✅ 3 dashboards simples (pas de composants complexes)
     - ✅ Tests minimaux mais critiques

  ## 9. Différences avec l'Approche Initiale

  | Aspect | Plan Initial (Ami) | Approche Pragmatique |
  |--------|-------------------|---------------------|
  | Tables | +3 nouvelles tables | 0 nouvelle table |
  | Contexts | RoleContext séparé | AuthContext enrichi |
  | Permissions | DB + classes | Dictionnaire Python |
  | Dashboards | Complexes | 3 cards simples |
  | RLS | Phase 2 | Dès le début |
  | Tests | Complets | Critiques seulement |
  
  Cette approche combine la **solidité architecturale** avec le **pragmatisme KISS** demandé.