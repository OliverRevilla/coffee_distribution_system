# Coffee Distribution API

Flask REST API backend for the Coffee Distribution System.

## Local Development

### Prerequisites

- Python 3.11+

### Setup

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set environment variables:
   ```bash
   export DATABASE_URL="postgresql://cafeadmin:<password>@localhost:5432/cafe_distribution"
   export AUTH_SECRET_KEY="<your-secret-key>"
   ```

4. Start the API:
   ```bash
   python app.py
   ```

   Or with Gunicorn (production-like):
   ```bash
   gunicorn --bind=0.0.0.0 --timeout 600 app:app
   ```

### API Endpoints

- `GET /api/health` - Health check
- `POST /api/auth/login` - Login
- `POST /api/auth/register/seller` - Seller self-registration
- `POST /api/auth/register` - Admin user creation
- `GET /api/sellers` - List sellers (admin)
- `GET /api/inventory` - List inventory (admin)
- `GET /api/variants` - List coffee variants
- `GET /api/sales` - List sales
- `POST /api/sales` - Create sale
- `GET /api/routes` - List routes
- `POST /api/routes` - Create route (admin)
- `POST /api/tracking/location` - Update GPS location
- `GET /api/complaints` - List complaints
- `POST /api/complaints` - Create complaint
- `GET /api/reports/sales` - Sales report (admin)

### Testing

```bash
pytest tests/ -v
```
