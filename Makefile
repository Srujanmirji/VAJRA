.PHONY: install test demo api
install:
	cd backend && pip install -r requirements.txt
test:
	cd backend && pytest -q
api:
	cd backend && uvicorn app.api.main:app --reload
demo:
	docker compose up --build
