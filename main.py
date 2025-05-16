import c3d_api

# If running directly (for development)
if __name__ == "__main__":
    import uvicorn
    # Use port 8080 which Replit exposes by default
    uvicorn.run(c3d_api.app, host="0.0.0.0", port=8080)