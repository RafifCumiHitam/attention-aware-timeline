"""Smoke-check that app modules import cleanly."""
import sys
sys.path.insert(0, ".")

def main():
    from app.main import app
    from app.infrastructure.database.models import User, Video, LearningSession, InteractionEvent
    routes = [r.path for r in app.routes if hasattr(r, "path")]
    print(f"OK — {len(routes)} routes registered")
    for p in sorted(set(routes)):
        print(f"  {p}")

if __name__ == "__main__":
    main()
