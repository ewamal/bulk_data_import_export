# Bulk Data Import/Export API

A high-performance, scalable system for bulk import and export of articles, comments, and users with streaming capabilities, robust validation, and comprehensive error handling.


## Requirements

- Node.js 18+
- PostgreSQL 15+
- 2GB RAM minimum
- Docker & Docker Compose (recommended)

## Installation

### Quick Start with Docker
```bash
# Clone the repository
git clone <repository-url>
cd bulk-import-export

# Start services with Docker Compose
docker-compose up -d

```

### Manual Installation
```bash
# Install dependencies
npm install


# Run database migrations
npx prisma migrate dev

# Start the application
npm run dev

# Start the worker (in another terminal)
npm run worker
```

## Configuration

### Environment Variables

For local development, create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/realworld?schema=public"
NODE_ENV="development"
PORT=3000
```

**Note:** 
- With Docker, these are configured in `docker-compose.yml` and you don't need a `.env` file.


### Docker Compose
The project includes a `docker-compose.yml` file that sets up:
- PostgreSQL 15 database
- API server
- Background worker

## API Documentation

### Import Endpoints

#### POST /v1/imports
Create an asynchronous import job.

**Headers:**
- `Idempotency-Key`: Unique key to prevent duplicate processing
- `Authorization`: Token <your-token> (or Bearer <your-token>)

**Query Parameters:**
- `resource`: Resource type (`users`, `articles`, `comments`)

**Body (multipart/form-data):**
- `file`: NDJSON, JSON, or CSV file

**Body (application/json):**
```json
{
  "url": "https://example.com/data.ndjson"
}
```

**Response (202 Accepted):**
```json
{
  "job_id": "123",
  "status": "accepted"
}
```

#### GET /v1/imports/{job_id}
Get import job status and errors.

**Response:**
```json
{
  "job_id": "123",
  "status": "completed",
  "resource": "users",
  "totalRecords": 10000,
  "successCount": 9500,
  "errorCount": 500,
  "errors": [
    {
      "recordIndex": 42,
      "errorMessage": "Invalid email format",
      "errorType": "VALIDATION_ERROR",
      "recordData": {...}
    }
  ],
  "startedAt": "2024-01-01T00:00:00Z",
  "completedAt": "2024-01-01T00:05:00Z"
}
```

### Export Endpoints

#### GET /v1/exports
Stream export data directly.

**Query Parameters:**
- `resource`: Resource type (`users`, `articles`, `comments`)
- `format`: Output format (`ndjson` or `json`, default: `ndjson`)

**Response:**
Streams data directly as NDJSON or JSON file download.

#### POST /v1/exports
Create an asynchronous export job.

**Headers:**
- `Idempotency-Key`: Unique key to prevent duplicate processing

**Body:**
```json
{
  "resource": "articles",
  "format": "ndjson",
  "filters": {
    "status": "published",
    "authorId": 123
  },
  "fields": ["id", "title", "slug", "author_id"]
}
```

**Response (202 Accepted):**
```json
{
  "job_id": "456",
  "status": "accepted"
}
```

#### GET /v1/exports/{job_id}
Get export job status.

**Response:**
```json
{
  "job_id": "456",
  "status": "completed",
  "resource": "articles",
  "format": "ndjson",
  "totalRecords": 50000,
  "downloadUrl": "/v1/exports/456/download",
  "completedAt": "2024-01-01T00:10:00Z"
}
```

#### GET /v1/exports/{job_id}/download
Download the exported file.


## Usage Examples

### Import Users
```bash
# Using file upload
curl -X POST http://localhost:3000/v1/imports?resource=users \
  -H "Authorization: Token <token>" \
  -H "Idempotency-Key: unique-123" \
  -F "file=@users.ndjson"

# Using URL
curl -X POST http://localhost:3000/v1/imports?resource=users \
  -H "Authorization: Token <token>" \
  -H "Idempotency-Key: unique-456" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/users.ndjson"}'

# Check status
curl http://localhost:3000/v1/imports/123 \
  -H "Authorization: Token <token>"
```

### Export Articles
```bash
# Stream export (immediate download)
curl http://localhost:3000/v1/exports?resource=articles&format=ndjson \
  -H "Authorization: Token <token>" \
  --output articles.ndjson

# Async export with filters
curl -X POST http://localhost:3000/v1/exports \
  -H "Authorization: Token <token>" \
  -H "Idempotency-Key: export-789" \
  -H "Content-Type: application/json" \
  -d '{
    "resource": "articles",
    "format": "json",
    "filters": {"status": "published"},
    "fields": ["id", "title", "slug"]
  }'

# Download exported file
curl http://localhost:3000/v1/exports/456/download \
  -H "Authorization: Token <token>" \
  --output export.json
```

### Import Order for Relational Data
```bash
# 1. Import users first (no dependencies)
curl -X POST http://localhost:3000/v1/imports?resource=users \
  -H "Authorization: Token <token>" \
  -H "Idempotency-Key: import-users-1" \
  -F "file=@users.ndjson"

# 2. Import articles (requires users to exist)
curl -X POST http://localhost:3000/v1/imports?resource=articles \
  -H "Authorization: Token <token>" \
  -H "Idempotency-Key: import-articles-1" \
  -F "file=@articles.ndjson"

# 3. Import comments (requires users and articles)
curl -X POST http://localhost:3000/v1/imports?resource=comments \
  -H "Authorization: Token <token>" \
  -H "Idempotency-Key: import-comments-1" \
  -F "file=@comments.ndjson"
```

### Metrics & Observability
The system logs:
- Records processed per second
- Error rate percentage
- Memory usage
- Processing duration

Example log output:
```
Job 123 progress: 100000 records, 95000 success, 5000 errors, error_rate: 5.00%, 8333 rows/sec, 52MB heap
```

## Architecture

### System Design
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   API       │────▶│  Database   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Worker    │
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  File Store │
                    └─────────────┘
```


### Processing Flow

1. Client uploads file or provides URL
2. API creates job with "pending" status
3. Worker polls for pending jobs
4. Worker processes file in streams with batching
5. Errors are recorded per-record
6. Job status updated to "completed" or "failed"

## Testing
```bash
# Run all tests
npm test

```

## Design Decisions

### Why Streaming?
- Handles files of any size without memory issues
- Provides real-time progress feedback
- Allows graceful interruption

### Why Batch Processing?
- Reduces database round-trips by 1000x
- Improves transaction performance
- Balances memory usage with speed

### UUID Handling
- System uses integer IDs internally for performance
- Stores external UUIDs in `externalId` field
- Maps UUIDs to internal IDs during import
- Preserves UUIDs in exports for round-trip compatibility

### Error Handling Strategy
- Continue processing on individual record failures
- Record detailed errors for debugging
- Return first 100 errors in API response
- Log all errors to database

### Worker Architecture
- Simple polling mechanism (no external dependencies)
- Processes up to 3 concurrent jobs
- Single worker sufficient for requirements
- Can scale horizontally if needed
