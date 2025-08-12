# Webhook Testing Suite

This folder contains all webhook-related tests and testing utilities for the EMG C3D Analyzer.

## Test Files

### Integration Tests
- `test_integration_webhook.py` - Full webhook integration testing
- `test_webhook_validation.py` - Webhook payload validation tests

### Automated Testing
- `test_automated_webhook.py` - Comprehensive automated webhook testing with database verification
- `test_webhook_simple.py` - Simple webhook functionality testing
- `test_webhook_basic.py` - Basic webhook endpoint testing

### ngrok Integration Tests
- `test_webhook_ngrok.py` - Webhook testing through ngrok tunnels
- `test_ngrok_webhook.py` - ngrok-specific webhook testing

### Utilities
- `monitor_webhook_activity.py` - Real-time webhook activity monitoring

## Usage

### Simple Testing
```bash
cd backend/tests/webhook
python test_webhook_simple.py
```

### Automated Testing (requires SUPABASE_SERVICE_KEY)
```bash
cd backend/tests/webhook
export SUPABASE_SERVICE_KEY=your_key_here
python test_automated_webhook.py
```

### Running with pytest
```bash
cd backend
python -m pytest tests/webhook/ -v
```

## Prerequisites

- ngrok installed and configured with auth token
- Backend running on port 8080
- Supabase service key (for automated tests)
- Sample C3D files in `backend/tests/samples/`

## Webhook Configuration & Troubleshooting

### How Supabase Storage Webhooks Work

**✅ Dashboard Uploads**: Manual uploads through Supabase Dashboard **DO trigger webhooks** when properly configured
**✅ API Uploads**: Programmatic uploads via client libraries also trigger webhooks  
**✅ Consistent Behavior**: Both upload methods trigger the same storage events and webhook system
**✅ Real Format Support**: Our webhook now handles the actual database trigger format from Supabase (`INSERT_storage.objects`)

### Why Your Webhook Might Not Be Triggering

**Common Issues**:

1. **⚠️ CRITICAL: Wrong Event Type**:
   - **Must use**: `storage.objects` (INSERT) events
   - **Common mistake**: Using `storage.buckets` instead  
   - This is the #1 reason webhooks fail with 422 errors

2. **Webhook URL Not Configured**: 
   - Go to Supabase Dashboard > Settings > Webhooks
   - Add webhook URL: `https://your-ngrok-url.ngrok-free.app/webhooks/storage/c3d-upload`
   - Select events: `INSERT` on `storage.objects` ⚠️ **NOT storage.buckets**

3. **ngrok Tunnel Expired**:
   - ngrok URLs change every restart unless you have a paid plan
   - Restart ngrok and update the webhook URL in Supabase Dashboard

4. **Bucket Configuration**:
   - Ensure files are uploaded to the correct bucket (`c3d-examples`)
   - Webhook only triggers for configured bucket/events

5. **Network Issues**:
   - Check if your local backend is accessible via ngrok
   - Verify no firewall blocking the webhook requests

### Testing Webhook Configuration

```bash
# 1. Verify ngrok is working
curl https://your-ngrok-url.ngrok-free.app/

# 2. Test webhook endpoint directly
python test_webhook_simple.py

# 3. Monitor logs during dashboard upload
tail -f ../../../logs/backend.error.log

# 4. Upload via dashboard and check logs immediately
```

### Expected Behavior

**Dashboard Upload → Webhook Trigger**: Should see webhook events in logs within 1-2 seconds of upload
**No Webhook Event**: Indicates configuration issue, not normal behavior