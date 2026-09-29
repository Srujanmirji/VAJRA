.PHONY: install test test-all api frontend run-sim run-replay demo clean

PYTHON ?= /opt/anaconda3/bin/python3
PYTEST ?= /opt/anaconda3/bin/pytest
UVICORN ?= /opt/anaconda3/bin/uvicorn

install:
	@echo "Installing backend dependencies..."
	cd backend && pip install -r requirements.txt
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

test:
	@echo "Running all backend unit and verification tests..."
	PYTHONPATH=backend $(PYTEST) -v

test-all: test
	@echo "Building frontend to verify TypeScript types..."
	cd frontend && npm run build

api:
	@echo "Starting VAJRA FastAPI Backend on port 8000..."
	PYTHONPATH=backend $(UVICORN) app.api.main:app --host 0.0.0.0 --port 8000 --reload

frontend:
	@echo "Starting VAJRA Next.js Frontend on port 3000..."
	cd frontend && npm run dev

run-sim:
	@echo "Spins up VAJRA with Simulated Radar / Satellite / Lightning stream..."
	VAJRA_DATA_MODE=SIMULATED PYTHONPATH=backend $(UVICORN) app.api.main:app --host 0.0.0.0 --port 8000 --reload

run-replay:
	@echo "Spins up VAJRA with Real Replay (Kolkata Nor'wester / SEVIR) sequence..."
	VAJRA_DATA_MODE=REPLAY PYTHONPATH=backend $(UVICORN) app.api.main:app --host 0.0.0.0 --port 8000 --reload

demo:
	@echo "====================================================================="
	@echo " Launching VAJRA Convective Nowcasting System (Demo Mode)"
	@echo "====================================================================="
	@echo "1. Starting backend..."
	PYTHONPATH=backend $(UVICORN) app.api.main:app --host 0.0.0.0 --port 8000 &
	@echo "2. Starting frontend..."
	cd frontend && npm run dev &
	@echo "3. Opening Forecaster Console in browser..."
	@sleep 3
	@which open > /dev/null && open http://localhost:3000/console || xdg-open http://localhost:3000/console || true

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	rm -rf frontend/.next
