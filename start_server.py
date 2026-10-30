import os
import sys
import uvicorn

if __name__ == "__main__":
    # Ensure current directory is on sys.path
    base_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(base_dir, "backend")
    if base_dir not in sys.path:
        sys.path.insert(0, base_dir)
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    print("=" * 65)
    print("  AutoCount Interface & e-Tax Admin Dashboard WebApp")
    print("=" * 65)
    print("  Server URL:       http://localhost:8000")
    print("  API Docs:         http://localhost:8000/docs")
    print("  Developer ID:     Piyarathl@gmail.com")
    print("  AutoCount Server: https://accounting-api.autocountcloud.com")
    print("=" * 65)

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, log_level="info")
