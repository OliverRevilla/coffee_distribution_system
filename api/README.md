# Coffee Distribution API

Azure Functions (Python) backend for the Coffee Distribution System.

## Local Development

### Prerequisites

- Python 3.11+
- Azure Functions Core Tools v4
- Azure CLI

### Setup

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   # venv\Scripts\activate   # Windows
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Copy the example settings:
   ```bash
   cp local.settings.example.json local.settings.json
   ```

4. Update `local.settings.json` with your Azure credentials.

5. Start the API:
   ```bash
   func start
   ```

### API Endpoints

- `GET /api/inventory` - List inventory (admin)
- `POST /api/inventory` - Create inventory item (admin)
- `GET /api/variants` - List coffee variants
- `POST /api/variants` - Create variant (admin)
- `GET /api/sales` - List sales
- `POST /api/sales` - Create sale
- `GET /api/routes` - List routes
- `POST /api/routes` - Create route (admin)
- `POST /api/tracking/location` - Update GPS location
- `GET /api/complaints` - List complaints
- `POST /api/complaints` - Create complaint

### Testing

```bash
pytest tests/ -v
```
