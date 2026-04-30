from fastapi.testclient import TestClient
import sys
import os

# Add backend to path so we can import main
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app

client = TestClient(app)

def test_get_projects_returns_list():
    response = client.get("/api/projects")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_health_check_or_similar():
    # If there's a specific simple endpoint, we can test it here.
    # Otherwise, this basic initialization confirms the FastAPI app builds and routes register correctly.
    pass
