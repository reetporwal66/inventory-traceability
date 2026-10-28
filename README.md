# StockSync — Product Batch Traceability and Recall Management System

StockSync is a product batch traceability and recall management system designed to help track products across inventory, warehouses, shipments, and recovery operations. It supports recall creation, affected-batch identification, inventory quarantine, shipment tracing, recovery recording, and event tracking.

The project combines **MySQL** for structured operational data with **MongoDB** for event records. A background worker processes events to support asynchronous event handling.

## Features

### 1. Recall Management
- Create and manage product recalls.
- Maintain recall details, reasons, and statuses.
- View recall history and recorded recovery actions.
- Track recall-related operational activity.

### 2. Batch Traceability
- Trace affected product batches.
- Retrieve associated inventory, warehouse, and shipment information.
- Identify where affected batches are stored or where they have been dispatched.
- View relevant batch and shipment details in one place.

### 3. Inventory and Warehouse Tracking
- Track batch-level inventory across warehouses.
- Display quantities on hand, reserved, quarantined, and available.
- Support inventory quarantine during recall operations.
- Associate inventory records with warehouse details.

### 4. Shipment Tracking
- Trace shipments associated with affected batches.
- Display shipment status, destination, and recipient information.
- Track dispatched and received quantities.
- Record shipment discrepancies and notes where applicable.

### 5. Recovery Management
- Record recall-related recovery actions.
- Track recovered quantities and associated batches.
- Maintain recovery details, timestamps, and notes.
- Display recorded recovery activity.

### 6. Event Tracking
- Store structured operational data in MySQL.
- Store event documents in MongoDB.
- Use a background worker to process events.
- Maintain event records that support operational tracking and debugging.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Styling | Tailwind CSS |
| Backend/API | Next.js API routes |
| Relational database | MySQL |
| Event storage | MongoDB |
| Background processing | MongoDB event worker |
| Package management | npm |
| Language | TypeScript |

## System Architecture

StockSync uses a web application architecture with separate responsibilities for the user interface, API routes, relational data, and event processing.

```text
User
  |
  v
Next.js Frontend
  |
  v
Next.js API Routes
  |
  +----------------------+
  |                      |
  v                      v
MySQL Database      MongoDB Event Store
                          |
                          v
                   Background Worker
```

**MySQL** stores the application's structured operational records, including recall, batch, inventory, shipment, and recovery information.

**MongoDB** stores event documents associated with operational activity.

The background worker processes event records separately from the main user-facing application flow.

## Prerequisites

Before running the project, ensure that the following are installed and available:

- Node.js and npm
- MySQL Server
- MongoDB Server or a compatible MongoDB deployment
- Git

You should also have access to the required database credentials and configuration values.

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/reetporwal66/inventory-traceability.git
cd inventory-traceability
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the project root and configure the environment variables required by the application.

Use the variable names expected by the project's database connection modules and worker configuration. Set the appropriate MySQL and MongoDB connection details for your environment.

Do not commit real database credentials, passwords, or other secrets to the repository.

### 4. Configure MySQL

1. Start MySQL Server.
2. Create or select the database used by the application.
3. Execute the project's database schema and setup SQL scripts.
4. Configure the application to connect to the database.
5. Verify that the required tables and relationships are available.

Use the SQL files included in the repository, where provided, rather than creating a different schema.

### 5. Configure MongoDB

1. Start MongoDB or configure access to your MongoDB deployment.
2. Set the required connection details.
3. Ensure the event store and collection configuration match the application's implementation.
4. Verify that the application and background worker can access MongoDB.

### 6. Run the Development Server

```bash
npm run dev
```

Open the local URL displayed in the terminal, typically:

`http://localhost:3000`

### 7. Run the Background Worker

The MongoDB event worker runs separately from the Next.js development server.

Use the worker command defined in the project's `package.json` or the worker's documented entry point. Ensure its environment variables and database connections are configured before starting it.

## Application Workflows

### Recall Workflow

1. Create a recall with the required details.
2. Identify the affected product batches.
3. Trace the related inventory and shipments.
4. Review the available quantity and distribution information.
5. Record applicable recovery actions.
6. Review recall history and recovery activity.

### Batch Traceability Workflow

1. Open the traceability interface.
2. Select or identify the relevant recall.
3. Review affected batches.
4. Inspect inventory by warehouse.
5. Review associated shipments and destinations.
6. Examine recovery records and other available traceability details.

### Event Processing Workflow

1. An application operation produces an event where event handling is implemented.
2. The event is stored in MongoDB.
3. The background worker processes events according to the worker's implementation.
4. Processed event records can be inspected for operational tracking and debugging.

The precise event lifecycle depends on the event types and processing logic implemented in the repository.

## Application Routes

The application includes the following API endpoints:

| Endpoint | Purpose |
|---|---|
| `/api/recalls/history` | Retrieves recall history and associated event information. |
| `/api/recalls/trace` | Retrieves traceability information for a recall, including related batches and operational records. |

The frontend also includes the following pages:

| Page | Purpose |
|---|---|
| `/recalls` | Recall management and history interface. |
| `/traceability` | Batch, inventory, shipment, and recovery traceability interface. |

Refer to the source files under `src/app/` for the current endpoint implementations and response formats.

## Database Design

### MySQL

MySQL is used for structured application data and relational queries.

The application's operational data covers the following areas:

- **Recalls:** Recall identifiers, codes, titles, reasons, statuses, and timestamps.
- **Batches:** Batch identifiers and codes, product details, supplier information, manufacture and expiry dates, costs, and affected quantities.
- **Inventory:** Batch and warehouse associations, stock quantities, reserved quantities, quarantined quantities, and available quantities.
- **Shipments:** Shipment identifiers and codes, status, batch details, source warehouse, destination and recipient details, dispatched and received quantities, and timestamps.
- **Recoveries:** Recovery identifiers, action types, affected batches, quantities, timestamps, and associated notes.

These records support the application's recall and traceability workflows.

### MongoDB

MongoDB is used as an event store for event documents generated or handled by the application.

The event store supports event processing and operational inspection independently of the structured relational records.

The exact document fields, collection names, indexes, and processing states should be verified against the MongoDB configuration and worker implementation in the repository.

## Project Structure

The project uses a Next.js application structure. The principal areas include:

```text
inventory-traceability/
├── docs/
│   └── screenshots/
├── src/
│   └── app/
│       ├── api/
│       │   └── recalls/
│       │       ├── history/
│       │       └── trace/
│       ├── recalls/
│       └── traceability/
├── package.json
└── README.md
```

This is a high-level overview of the main application areas, not an exhaustive listing of every project file. Database scripts, connection utilities, worker files, configuration files, and other modules are located in their respective project directories.

## Screenshots and Documentation

The `docs/screenshots/` directory contains screenshots of the application's workflows, database tables and queries, MongoDB event documents, and operational features.

For detailed project documentation, see the [StockSync DBMS Level 3 Project Report](docs/StockSync_DBMS_Level3_Report.pdf).

## Testing and Verification

Before considering the application ready for demonstration, verify the following:

- [ ] Dependencies install successfully.
- [ ] Required environment variables are configured.
- [ ] MySQL connects successfully and the required schema is present.
- [ ] MongoDB connects successfully.
- [ ] The development server starts successfully.
- [ ] Recall history loads correctly.
- [ ] Recall traceability data loads correctly.
- [ ] Inventory, shipment, and recovery information is displayed correctly.
- [ ] The background worker starts and processes supported events.
- [ ] Relevant API responses and error cases behave as expected.
- [ ] Linting and production build complete successfully.

Run the lint and build commands defined in `package.json`. Do not treat a command as passing until it has been executed successfully in the current environment.

## Security Considerations

- Keep database credentials and secrets in environment variables.
- Do not commit `.env.local` or other files containing real credentials.
- Validate request inputs before executing database operations.
- Use parameterized SQL queries to reduce SQL injection risk.
- Handle database connection errors and unexpected API responses safely.
- Avoid exposing unnecessary personal, recipient, or supplier information.
- Restrict database access according to the application's deployment requirements.

These are security considerations for the project; the presence of a recommendation in this section does not itself confirm that every measure has been implemented.

## Limitations

- The completeness of traceability depends on the availability and accuracy of the underlying batch, inventory, and shipment records.
- Recall and recovery information is only as reliable as the recorded operational data.
- Event processing depends on MongoDB availability and the correct configuration of the background worker.
- Database setup and environment configuration are required before the application can run correctly.
- Production readiness depends on testing, error handling, access controls, and deployment configuration.

## Project Status

StockSync is a product batch traceability and recall management application built around a Next.js frontend, API routes, MySQL relational storage, and MongoDB event processing.

The project brings together recall management, batch tracing, inventory visibility, shipment tracking, and recovery records to support recall-related workflows.

The final verified status of linting, production builds, and end-to-end event processing should be confirmed by running the corresponding checks in the current development environment.
