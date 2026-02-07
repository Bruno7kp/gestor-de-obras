
# Canteiro Digital System Architecture

## 1. High-Level Design
Canteiro Digital is architected using a **Decoupled Client-Server Model**. 

### Frontend (Modern React SPA)
- **UI Framework:** React 18+ with TypeScript for strict type safety.
- **Styling:** Tailwind CSS for institutional-grade, responsive design.
- **State Management:** Functional hooks with a robust `TreeService` for recursive operations.
- **Data Persistence:** Mocked API layer initially using `localStorage`, architected for immediate migration to a REST/GraphQL API.

### Backend (Architecture Recommendation)
- **Language:** Node.js (TypeScript) or Go.
- **API Style:** RESTful with DTO validation.
- **Database:** PostgreSQL (Relational) - Critical for hierarchical queries.
- **ORM:** Prisma or TypeORM.

## 2. The Heart of the System: The WBS Algorithm
The system utilizes a **Flattened Representation** in the database for performance, but constructs a **Virtual Tree** in-memory for calculations.

1.  **Normalization:** All nodes (Categories and Items) are stored in a flat list with a `parentId`.
2.  **Virtual Tree Construction:** `buildTree()` recursively maps children to parents.
3.  **Recursive Processing:** `processRecursive()` performs two tasks simultaneously:
    - **WBS Labeling:** Generates hierarchical numbering (e.g., 1.2.1).
    - **Financial Rollup:** Sums leaf item values upward to parents.
4.  **Flattening for UI:** `flattenTree()` converts the tree back to a sorted list for high-performance table rendering while respecting expansion states.

## 3. Financial Precision
To avoid floating-point errors common in construction finance (where 0.1 + 0.2 != 0.3), the system uses a dedicated `DecimalSafe` utility ensuring all calculations are rounded and validated before storage.

## 4. Layer Responsibility
- **Model Layer:** Defines the `WorkItem` structure.
- **Service Layer:** Handles tree logic, PDF generation, and Excel parsing.
- **Component Layer:** Purely presentational or logic-light UI elements.
