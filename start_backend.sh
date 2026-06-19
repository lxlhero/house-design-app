cd "$(dirname "$0")/backend"
python3 -m pip install -q -r requirements.txt
python3 seed.py
echo ""
echo "Starting backend on http://localhost:8000"
echo "API docs: http://localhost:8000/docs"
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
