---
sidebar_position: 6
title: Webhooks Processing
---

# Webhooks Processing

Background processing when C3D files are uploaded to Supabase Storage.

## How It Works

1. File uploaded to Supabase Storage
2. Supabase triggers webhook → `/webhooks/storage/c3d-upload`
3. Backend downloads file, processes EMG data
4. Results saved to database

## Security

- HMAC signature validation for webhook authenticity
- Patient code extracted from filename

## Files

- `api/routes/webhooks.py` - Webhook endpoint (349 lines)
- `services/clinical/therapy_session_processor.py` - Processing orchestration (1,669 lines)

## Workflow

1. **Webhook receives event** - Validates HMAC signature
2. **Extract patient code** - From filename (e.g., `GHOST001_session.c3d`)
3. **Create session record** - In database
4. **Download file** - From Supabase Storage to temp location  
5. **Process EMG data** - Using `GHOSTLYC3DProcessor`
6. **Save results** - To database tables
7. **Update session status** - Mark as completed
8. **Cleanup** - Remove temporary file

## Configuration

Set up in Supabase Dashboard → Storage → Webhooks:
- URL: `https://your-domain.com/webhooks/storage/c3d-upload`
- Events: `storage.objects.create`
- Bucket: `c3d-examples`

## Testing

Use ngrok for local webhook testing:

```bash
./start_dev.sh --webhook
```