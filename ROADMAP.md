# ROADMAP.md — AI Data Analyst

## PHASE 1 — FOUNDATION & PLATFORM SETUP

### Milestone 1.1 — Project Documentation
- Finalize PROJECT_SPEC.md
- Finalize ROADMAP.md
- Initialize PROGRESS.md

### Milestone 1.2 — Local Development Environment
- Verify Node.js
- Verify npm
- Verify Git
- Verify Docker
- Verify PostgreSQL
- Verify Redis

### Milestone 1.3 — Repository & Application Foundation
- Initialize project repository
- Initialize Next.js application
- Initialize NestJS application
- Establish workspace structure
- Configure environment variables
- Establish shared configuration conventions

### Milestone 1.4 — Core Infrastructure
- PostgreSQL connection
- Redis connection
- BullMQ foundation
- Background worker foundation
- Object-storage integration foundation

### Milestone 1.5 — Core Architecture
- Authentication foundation
- Workspace / tenant model
- Initial data model
- Security foundation
- Query-execution architecture
- AI abstraction architecture

---

## PHASE 2 — CORE DATA ANALYST PRODUCT

### Milestone 2.1 — Data Upload & Ingestion
- CSV upload
- Excel upload
- File validation
- Dataset metadata
- Secure storage
- Dataset lifecycle

### Milestone 2.2 — Dataset Understanding
- Schema detection
- Column/type detection
- Basic data profiling
- Relationship detection where applicable

### Milestone 2.3 — Natural Language Query Engine
- Natural-language question input
- Schema-aware context
- SQL generation
- SQL validation
- Read-only query enforcement
- Query execution

### Milestone 2.4 — Results & Visualization
- Result tables
- KPI summaries
- Chart generation
- Chart type selection
- SQL view
- SQL explanation
- Result export

### Milestone 2.5 — Core Product UI
- Dashboard
- Dataset management
- Query workspace
- Results workspace
- Loading/error/empty states
- Responsive UI

---

## PHASE 3 — INTELLIGENT ANALYTICS ENGINE

### Milestone 3.1 — Conversational Analysis
- Follow-up questions
- Context-aware analysis
- Query refinement
- Analysis history

### Milestone 3.2 — Advanced SQL Intelligence
- JOINs
- GROUP BY / HAVING
- Subqueries
- EXISTS / IN / NOT IN
- CTEs
- Window functions
- Safer query planning

### Milestone 3.3 — Python Analytics Layer
- Validated result processing
- Statistical calculations where required
- Advanced transformations
- Data preparation for visualization

### Milestone 3.4 — Multi-File Intelligence
- Multiple dataset analysis
- Relationship mapping
- Cross-file queries
- Combined analysis

### Milestone 3.5 — AI Insights
- Automatic insight generation
- Trend detection
- Anomaly explanations
- Source/result grounding
- Structured AI outputs

### Milestone 3.6 — Background Processing
- Long-running query jobs
- BullMQ workers
- Retry handling
- Job status tracking
- Resource limits
- Job cleanup

---

## PHASE 4 — PRODUCT EXPERIENCE, MONETIZATION & HARDENING

### Milestone 4.1 — Workspace Experience
- Saved analyses
- Saved queries
- Reports
- History
- Dataset management improvements

### Milestone 4.2 — Monetization
- Free plan
- Pro plan
- Entitlements
- Usage limits
- Usage metering
- Billing integration

### Milestone 4.3 — Sharing & Reporting
- Shareable reports
- Export improvements
- Report generation
- Controlled sharing permissions

### Milestone 4.4 — Security & Reliability
- Authentication hardening
- Authorization checks
- Tenant isolation testing
- Query safety hardening
- Rate limiting
- Abuse protection
- Secure logging
- Secret protection

### Milestone 4.5 — Performance & Observability
- Database indexes
- Query optimization
- Redis caching where useful
- Connection pooling
- API performance
- Structured logging
- Metrics
- Error tracking
- System health monitoring

---

## PHASE 5 — PRODUCTION LAUNCH & CONTROLLED SCALE

### Milestone 5.1 — Production Infrastructure
- Production Next.js deployment
- Production NestJS deployment
- Production PostgreSQL
- Production Redis
- Production object storage
- Background workers

### Milestone 5.2 — Production Security
- HTTPS
- Secret management
- Access controls
- Security configuration
- Backup strategy

### Milestone 5.3 — Testing & Verification
- Unit tests
- Integration tests
- End-to-end tests
- Query safety tests
- Performance testing
- Failure/recovery testing

### Milestone 5.4 — Launch Readiness
- Production monitoring
- Alerting
- Backup verification
- Deployment verification
- Final security review
- Final performance review
- Launch checklist

### Milestone 5.5 — Controlled Post-Launch Expansion
Only after the core product is stable:
- More data sources
- Database connectors
- Scheduled reports
- Team collaboration
- Public API
- Advanced dashboards
- Business plans
- Additional analytics capabilities