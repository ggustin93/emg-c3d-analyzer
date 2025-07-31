# Supabase Client Integration

Complete Supabase integration for authentication, storage, and database operations.

## Client Configuration

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL!
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})
```

## Authentication Patterns

### Login Flow
```typescript
// services/authService.ts
export class AuthService {
  static async loginWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) throw new Error(error.message)
    return data
  }

  static async logout() {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
  }
}
```

### Session Management
```typescript
// Context pattern with persistent sessions
const { data: { session } } = await supabase.auth.getSession()
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (event, session) => {
    if (event === 'SIGNED_IN') setAuthState(createAuthenticatedState(session))
    if (event === 'SIGNED_OUT') setAuthState(createLoggedOutState())
  }
)
```

## Storage Integration

### Bucket Structure
```
c3d-examples/
├── P005/                    # Patient folders
│   ├── file1.c3d
│   └── file2.c3d
├── P008/
│   └── file3.c3d
└── root_file.c3d           # Legacy files
```

### File Operations
```typescript
// services/supabaseStorage.ts
export class SupabaseStorageService {
  private static readonly BUCKET_NAME = 'c3d-examples'

  // List files with subfolder discovery
  static async listC3DFiles(): Promise<C3DFileInfo[]> {
    const { data: rootFiles } = await supabase.storage
      .from(this.BUCKET_NAME)
      .list('', { sortBy: { column: 'created_at', order: 'desc' } })

    // Auto-discover patient folders (P005/, P008/, etc.)
    const directories = rootFiles?.filter(item => 
      !item.metadata?.size && item.name.match(/^P\d{3}$/)
    ) || []

    // Recursively list subfolder files
    const allFiles = [...rootFiles]
    for (const dir of directories) {
      const { data: subFiles } = await supabase.storage
        .from(this.BUCKET_NAME)
        .list(dir.name)
      
      subFiles?.forEach(file => {
        allFiles.push({ ...file, name: `${dir.name}/${file.name}` })
      })
    }

    return allFiles.filter(file => file.name.toLowerCase().endsWith('.c3d'))
  }

  // Download with subfolder support
  static async downloadFile(filename: string): Promise<Blob> {
    const { data, error } = await supabase.storage
      .from(this.BUCKET_NAME)
      .download(filename)
    
    if (error) throw new Error(`Failed to download: ${error.message}`)
    return data
  }
}
```

## Database Operations

### Row Level Security (RLS)
All tables have RLS enabled with policies:

```sql
-- researcher_profiles: Users can only access their own profile
CREATE POLICY "Users can view own profile" ON researcher_profiles
  FOR SELECT USING (auth.uid() = id);

-- emg_sessions: Access through therapist relationships
CREATE POLICY "Therapists can access patient sessions" ON emg_sessions
  FOR SELECT USING (
    patient_id IN (
      SELECT id FROM patients 
      WHERE therapist_id IN (
        SELECT id FROM therapists WHERE user_id = auth.uid()
      )
    )
  );
```

### Data Access Patterns
```typescript
// Get user profile
const { data: profile } = await supabase
  .from('researcher_profiles')
  .select('*')
  .eq('id', user.id)
  .single()

// Get patient sessions with therapist filtering
const { data: sessions } = await supabase
  .from('emg_sessions')
  .select(`
    *,
    patients (
      patient_code,
      therapists (
        first_name,
        last_name
      )
    )
  `)
  .order('recorded_at', { ascending: false })
```

## Error Handling

### Common Patterns
```typescript
try {
  const { data, error } = await supabaseOperation()
  
  if (error) {
    // Supabase-specific error handling
    if (error.message.includes('not found')) {
      throw new Error('Resource not found')
    }
    if (error.message.includes('unauthorized')) {
      throw new Error('Authentication required')
    }
    throw new Error(`Database error: ${error.message}`)
  }
  
  return data
} catch (error) {
  console.error('Supabase operation failed:', error)
  throw error
}
```

### Auth Error Recovery
```typescript
// Auto-retry with fresh session
if (error.message.includes('JWT expired')) {
  await supabase.auth.refreshSession()
  return retryOperation()
}
```

## Performance Optimization

### Efficient Queries
```typescript
// Use select() to limit data transfer
.select('id, name, created_at')  // Not select('*')

// Use single() for one-row expectations
.single()  // Throws error if 0 or >1 rows

// Use range() for pagination
.range(0, 49)  // First 50 items
```

### Caching Strategy
```typescript
// Client-side caching for file lists
const cachedFiles = useMemo(() => {
  return files // Memoize expensive file processing
}, [files])
```

## Environment Configuration

### Required Variables
```bash
# .env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key

# Backend (if needed)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Connection Validation
```typescript
export const isSupabaseConfigured = (): boolean => {
  return !!(
    process.env.REACT_APP_SUPABASE_URL &&
    process.env.REACT_APP_SUPABASE_ANON_KEY
  )
}
```

## Integration Points

### With Authentication Context
```typescript
// AuthProvider uses Supabase auth state
const [authState, setAuthState] = useState<AuthState>(createLoggedOutState())

useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      handleAuthStateChange(event, session)
    }
  )
  return () => subscription.unsubscribe()
}, [])
```

### With File Browser
```typescript
// C3DFileBrowser integrates with storage service
const [files, setFiles] = useState<C3DFileInfo[]>([])

useEffect(() => {
  const loadFiles = async () => {
    if (isAuthenticated) {
      const fileList = await SupabaseStorageService.listC3DFiles()
      setFiles(fileList)
    }
  }
  loadFiles()
}, [isAuthenticated])
```

## Security Best Practices

- **Never expose service role key** in frontend code
- **Use RLS policies** for all data access control
- **Validate JWT tokens** on sensitive operations
- **Implement proper error handling** to avoid information leakage
- **Use type safety** with TypeScript for all Supabase operations