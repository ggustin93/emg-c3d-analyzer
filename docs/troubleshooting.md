# Troubleshooting Guide

Common issues and solutions for development and production environments.

## Authentication Issues

### Infinite Loading Spinner
**Symptoms**: "Checking researcher access..." never completes

**Causes & Solutions**:
```typescript
// ❌ Multiple AuthProvider initializations
// Fix: Ensure single AuthProvider wrapper in App.tsx
const isInitializedRef = useRef(false)
useEffect(() => {
  if (isInitializedRef.current) return // Prevent duplicate initialization
  isInitializedRef.current = true
}, [])

// ❌ Logout loading loop  
// Fix: Immediate state transition
const logout = async () => {
  setAuthState(createLoggedOutState()) // Not loading state
  await AuthService.logout()
}
```

**Debug Steps**:
1. Check console for multiple "🔐 Initializing authentication..." messages
2. Verify single AuthProvider in component tree
3. Check network tab for repeated auth requests

### Supabase Connection Failures
**Symptoms**: "Authentication required" or connection timeouts

**Environment Check**:
```bash
# Verify environment variables
echo $REACT_APP_SUPABASE_URL
echo $REACT_APP_SUPABASE_ANON_KEY

# Test Supabase connection
curl -H "apikey: YOUR_ANON_KEY" https://YOUR_PROJECT.supabase.co/rest/v1/
```

**Common Fixes**:
- **Invalid URL**: Ensure URL doesn't end with trailing slash
- **Wrong key**: Use anon key (not service role key) in frontend
- **RLS policies**: Check Row Level Security permissions

### JWT Token Issues
**Symptoms**: "Invalid JWT" or "Token expired" errors

**Solutions**:
```typescript
// Auto-refresh expired tokens
if (error.message.includes('JWT expired')) {
  await supabase.auth.refreshSession()
  return retryOperation()
}

// Clear corrupted tokens
if (error.message.includes('Invalid JWT')) {
  await supabase.auth.signOut()
  window.location.reload()
}
```

## File Upload & Processing

### C3D File Processing Failures
**Symptoms**: "Failed to process C3D file" or 422 errors

**Debug Steps**:
```python
# Backend debugging
try:
    c3d_data = c3d.read(file_path)
    print(f"C3D channels: {c3d_data['parameters']['POINT']['LABELS']['value']}")
    print(f"Sampling rate: {c3d_data['parameters']['POINT']['RATE']['value']}")
except Exception as e:
    print(f"C3D parsing error: {e}")
```

**Common Issues**:
- **Invalid format**: File is not a valid C3D file
- **Corrupted data**: File upload truncated or modified
- **Missing channels**: No EMG channels found in file
- **Sampling rate**: Invalid or missing sampling rate

### File Upload Size Limits
**Symptoms**: Upload fails for large files

**Solutions**:
```python
# Backend - Increase upload limits
from fastapi import FastAPI, File, UploadFile

app = FastAPI()

@app.post("/upload")
async def upload_file(file: UploadFile = File(..., max_size=20*1024*1024)):  # 20MB
    pass
```

```nginx
# If using nginx reverse proxy
client_max_body_size 20M;
```

### Supabase Storage Issues  
**Symptoms**: "File not found" or storage access errors

**Debug Storage**:
```typescript
// Check bucket existence
const { data: buckets } = await supabase.storage.listBuckets()
console.log('Available buckets:', buckets)

// Check file permissions
const { data: files, error } = await supabase.storage
  .from('c3d-examples')
  .list()
console.log('Storage error:', error)
console.log('Files found:', files?.length)
```

**Common Fixes**:
- **Missing bucket**: Create 'c3d-examples' bucket in Supabase dashboard
- **RLS policies**: Configure storage policies for authenticated users
- **File paths**: Ensure correct subfolder structure (P005/, P008/, etc.)

## Build & Compilation

### TypeScript Compilation Errors
**Symptoms**: Build fails with type errors

**Common Fixes**:
```typescript
// ❌ Missing null checks
const value = data.someProperty.value // May be undefined

// ✅ Proper null handling  
const value = data?.someProperty?.value ?? defaultValue

// ❌ Incorrect type imports
import { User } from 'supabase' // Wrong import

// ✅ Correct Supabase types
import { User } from '@supabase/supabase-js'
```

### Dependency Conflicts
**Symptoms**: "Module not found" or version conflicts

**Resolution Steps**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for peer dependency issues
npm ls --depth=0

# Fix specific dependency conflicts
npm install --legacy-peer-deps
```

### React 19 Compatibility Issues
**Symptoms**: Build errors with React 19

**Solution**:
```json
// package.json - Downgrade to React 18
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
```

## Performance Issues

### Slow Chart Rendering
**Symptoms**: EMG charts lag or freeze during rendering

**Optimizations**:
```typescript
// ❌ Too many data points
const chartData = rawSignalData // 20,000+ points

// ✅ Downsample for performance
const chartData = useMemo(() => {
  return downsampleData(rawSignalData, 1000) // Limit to 1000 points
}, [rawSignalData])

// ❌ No memoization
const expensiveCalculation = processData(data, params)

// ✅ Memoize expensive calculations  
const expensiveCalculation = useMemo(() => {
  return processData(data, params)
}, [data, params])
```

### Memory Leaks
**Symptoms**: Browser memory usage increases over time

**Prevention**:
```typescript
// ❌ Missing cleanup
useEffect(() => {
  const subscription = supabase.auth.onAuthStateChange(callback)
  // Missing cleanup
}, [])

// ✅ Proper cleanup
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback)
  return () => subscription.unsubscribe() // Cleanup
}, [])
```

### Backend Processing Timeouts
**Symptoms**: 504 Gateway Timeout errors

**Solutions**:
```python
# Optimize processing with threading
from concurrent.futures import ThreadPoolExecutor
import asyncio

executor = ThreadPoolExecutor(max_workers=2)

@app.post("/upload")
async def upload_file(file: UploadFile):
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(executor, process_emg_file, file)
    return result
```

## Development Environment

### MCP Server Connection Issues
**Symptoms**: "MCP server not found" or connection failures

**Debug Steps**:
```bash
# Check MCP server status
claude mcp list

# Verify MCP configuration
cat ~/.config/claude/mcp_servers.json

# Test individual server
claude mcp test supabase
```

**Common Fixes**:
- **Missing configuration**: Add server to mcp_servers.json
- **Path issues**: Verify MCP server installation paths
- **Permissions**: Check file permissions for MCP executables

### Hot Reload Issues
**Symptoms**: Changes not reflected during development

**Solutions**:
```bash
# Frontend - Clear cache and restart
rm -rf .next node_modules/.cache
npm start

# Backend - Restart with clean reload
uvicorn main:app --reload --reload-dir . --reload-exclude "*.log"
```

### Port Conflicts
**Symptoms**: "Port already in use" errors

**Solutions**:
```bash
# Find and kill process using port
lsof -ti:3000 | xargs kill -9  # Frontend
lsof -ti:8000 | xargs kill -9  # Backend

# Use different ports
REACT_APP_PORT=3001 npm start
uvicorn main:app --port 8001
```

## Production Issues

### CORS Errors
**Symptoms**: "Access-Control-Allow-Origin" errors

**Solutions**:
```python
# Backend - Update CORS origins
ALLOWED_ORIGINS = [
    "https://emg-c3d-analyzer.vercel.app",
    "https://emg-c3d-analyzer-git-main-username.vercel.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```

### Environment Variable Issues
**Symptoms**: Features not working in production

**Debug**:
```typescript
// Check environment variables at runtime
console.log('Environment check:', {
  hasSupabaseUrl: !!process.env.REACT_APP_SUPABASE_URL,
  hasSupabaseKey: !!process.env.REACT_APP_SUPABASE_ANON_KEY,
  apiUrl: process.env.REACT_APP_API_URL
})
```

### Deployment Failures
**Symptoms**: Build or deployment errors

**Common Fixes**:
- **Missing dependencies**: Check requirements.txt or package.json
- **Build timeouts**: Optimize build process or increase limits
- **Memory limits**: Reduce bundle size or upgrade hosting tier

## Error Monitoring

### Console Error Patterns
```typescript
// Expected vs problematic console messages

// ✅ Expected (good)
"🔐 Auth Provider: Single initialization starting..."
"✅ Patient ID from subfolder: P005"  
"✅ File metadata found: filename.c3d"

// ❌ Problematic (investigate)
"❌ No Patient ID found in: filename.c3d"
"Multiple Auth initializations detected"
"Uncaught TypeError: Cannot read property..."
```

### Network Request Debugging
```bash
# Monitor network requests
# Check browser Network tab for:
- Failed requests (4xx, 5xx status codes)
- Long response times (>5s)
- Repeated identical requests (potential loops)
- CORS preflight failures
```

## Emergency Recovery

### Complete Reset Procedure
```bash
# Full development environment reset
1. Clear all caches:
   rm -rf node_modules .next build backend/__pycache__
   
2. Reinstall dependencies:
   npm install
   cd backend && pip install -r requirements.txt
   
3. Reset authentication:
   - Clear browser localStorage
   - Sign out of Supabase dashboard
   - Restart development servers

4. Verify configuration:
   - Check all environment variables
   - Test Supabase connection
   - Confirm MCP server status
```

### Production Rollback
```bash
# Quick production rollback
# Frontend (Vercel)
vercel --prod --rollback [previous-deployment-url]

# Backend (Render)  
git revert HEAD
git push origin main  # Triggers redeployment
```

## Getting Help

### Debug Information to Collect
1. **Browser console logs** (full stack traces)
2. **Network tab** (failed requests)
3. **Environment details** (Node version, browser, OS)
4. **Steps to reproduce** (detailed sequence)
5. **Sample files** (for C3D processing issues)

### Support Channels
- **Technical issues**: Check GitHub issues
- **Supabase problems**: Supabase documentation/support
- **MCP server issues**: Claude Code documentation