# Memory Box Deployment Guide

This guide provides step-by-step instructions for deploying Memory Box on Snowpark Container Services (SPCS). The deployment process is designed for enterprise environments with appropriate security and operational considerations.

## Prerequisites

### Snowflake Account Requirements

**Account Features**
- Snowflake account with SPCS enabled
- Cortex AI features enabled (including cross-region if needed)
- ACCOUNTADMIN privileges for initial setup
- Appropriate compute credits for SPCS workloads

**Feature Enablement**
```sql
-- Enable SPCS (requires ACCOUNTADMIN)
ALTER ACCOUNT SET ENABLE_SPCS = TRUE;

-- Enable cross-region Cortex AI access (if needed)
ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'AWS_US';
```

### Required Permissions

**Administrative Privileges**
- CREATE COMPUTE POOL on account
- CREATE SERVICE on account
- BIND SERVICE ENDPOINT on account
- CREATE DATABASE and SCHEMA privileges
- CREATE IMAGE REPOSITORY privileges

**Operational Roles**
```sql
-- Create Memory Box admin role
CREATE ROLE MEMORY_BOX_ADMIN;
GRANT ROLE MEMORY_BOX_ADMIN TO USER <admin_user>;

-- Grant required privileges
GRANT CREATE COMPUTE POOL ON ACCOUNT TO ROLE MEMORY_BOX_ADMIN;
GRANT CREATE SERVICE ON ACCOUNT TO ROLE MEMORY_BOX_ADMIN;
GRANT BIND SERVICE ENDPOINT ON ACCOUNT TO ROLE MEMORY_BOX_ADMIN;
```

## Phase 1: Infrastructure Setup

### Database and Schema Creation

```sql
-- Create Memory Box database
CREATE DATABASE IF NOT EXISTS MEMORY_BOX_DB;
USE DATABASE MEMORY_BOX_DB;

-- Create core schema
CREATE SCHEMA IF NOT EXISTS CORE;
USE SCHEMA CORE;

-- Create Memory Box storage table
CREATE TABLE IF NOT EXISTS MEMORIES (
    memory_id STRING PRIMARY KEY,
    content STRING NOT NULL,
    content_type STRING NOT NULL,
    embedding VECTOR(FLOAT, 768) NOT NULL,
    owner_user STRING NOT NULL DEFAULT CURRENT_USER(),
    access_level STRING NOT NULL DEFAULT 'PRIVATE',
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    source_database STRING,
    source_query STRING,
    tags ARRAY,
    metadata OBJECT
);
```

### Compute Pool Configuration

```sql
-- Frontend compute pool (optimized for UI serving)
CREATE COMPUTE POOL IF NOT EXISTS MEMORY_BOX_FRONTEND_POOL
  MIN_NODES = 1
  MAX_NODES = 3
  INSTANCE_FAMILY = CPU_X64_XS
  AUTO_RESUME = TRUE
  AUTO_SUSPEND_SECS = 300
  COMMENT = 'Memory Box frontend services';

-- Backend compute pool (optimized for API processing)
CREATE COMPUTE POOL IF NOT EXISTS MEMORY_BOX_BACKEND_POOL
  MIN_NODES = 1
  MAX_NODES = 5
  INSTANCE_FAMILY = CPU_X64_S
  AUTO_RESUME = TRUE
  AUTO_SUSPEND_SECS = 300
  COMMENT = 'Memory Box backend services and Memory Box operations';
```

### Image Repository Setup

```sql
-- Create image repository for Memory Box containers
CREATE IMAGE REPOSITORY IF NOT EXISTS MEMORY_BOX_IMAGES
  COMMENT = 'Container images for Memory Box deployment';

-- Show repository URL for image pushing
SHOW IMAGE REPOSITORIES LIKE 'MEMORY_BOX_IMAGES';
```

## Phase 2: Container Preparation

### Container Build Process

**Frontend Container**
```dockerfile
# Multi-stage build for optimized frontend
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/out /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Backend Container**
```dockerfile
# Multi-stage build for optimized backend
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3001
CMD ["node", "server.js"]
```

### Image Building and Pushing

```bash
# Build and tag images
docker build -f docker/frontend/Dockerfile -t memory-box-frontend:latest .
docker build -f docker/backend/Dockerfile -t memory-box-backend:latest .

# Tag for Snowflake repository
docker tag memory-box-frontend:latest <repository_url>/frontend:latest
docker tag memory-box-backend:latest <repository_url>/backend:latest

# Push to Snowflake image repository
docker push <repository_url>/frontend:latest
docker push <repository_url>/backend:latest
```

## Phase 3: Service Deployment

### Backend Service Deployment

```sql
-- Deploy Memory Box backend service
CREATE SERVICE MEMORY_BOX_BACKEND
IN COMPUTE POOL MEMORY_BOX_BACKEND_POOL
FROM SPECIFICATION $$
spec:
  containers:
  - name: backend
    image: /memory_box_db/core/memory_box_images/backend:latest
    env:
      NODE_ENV: production
      PORT: "3001"
      SNOWFLAKE_ACCOUNT: "<your_account>"
      SNOWFLAKE_DATABASE: "MEMORY_BOX_DB"
      SNOWFLAKE_SCHEMA: "CORE"
      SNOWFLAKE_WAREHOUSE: "MEMORY_BOX_WAREHOUSE"
      USE_SPCS_IDENTITY: "true"
    resources:
      requests:
        cpu: 1
        memory: 2G
      limits:
        cpu: 2
        memory: 4G
    readinessProbe:
      port: 3001
      path: /api/health
  endpoints:
  - name: api
    port: 3001
    public: false
$$
MIN_INSTANCES = 1
MAX_INSTANCES = 3
COMMENT = 'Memory Box backend API service';
```

### Frontend Service Deployment

```sql
-- Deploy Memory Box frontend service
CREATE SERVICE MEMORY_BOX_FRONTEND
IN COMPUTE POOL MEMORY_BOX_FRONTEND_POOL
FROM SPECIFICATION $$
spec:
  containers:
  - name: frontend
    image: /memory_box_db/core/memory_box_images/frontend:latest
    env:
      NODE_ENV: production
      BACKEND_URL: "http://memory-box-backend.memory-box-db.svc.spcs.internal:3001"
    resources:
      requests:
        cpu: 0.5
        memory: 512M
      limits:
        cpu: 1
        memory: 1G
  endpoints:
  - name: web
    port: 80
    public: true
$$
MIN_INSTANCES = 1
MAX_INSTANCES = 2
COMMENT = 'Memory Box frontend web interface';
```

## Phase 4: Configuration and Security

### Authentication Configuration

**OAuth Integration Setup**
```sql
-- Create OAuth security integration (Customer Self-Deploy model)
CREATE SECURITY INTEGRATION MEMORY_BOX_OAUTH
  TYPE = OAUTH
  ENABLED = TRUE
  OAUTH_CLIENT = CUSTOM
  OAUTH_CLIENT_TYPE = 'CONFIDENTIAL'
  OAUTH_REDIRECT_URI = 'https://<service-endpoint>/auth/callback'
  OAUTH_ISSUE_REFRESH_TOKENS = TRUE
  OAUTH_REFRESH_TOKEN_VALIDITY = 86400
  COMMENT = 'OAuth integration for Memory Box authentication';
```

**Service Account Setup** (Managed Service model)
```sql
-- Create service account and role
CREATE ROLE MEMORY_BOX_SERVICE_ROLE;
CREATE USER MEMORY_BOX_SERVICE
  DEFAULT_ROLE = MEMORY_BOX_SERVICE_ROLE
  MUST_CHANGE_PASSWORD = FALSE
  COMMENT = 'Service account for Memory Box managed deployment';

-- Grant necessary permissions
GRANT USAGE ON DATABASE MEMORY_BOX_DB TO ROLE MEMORY_BOX_SERVICE_ROLE;
GRANT USAGE ON SCHEMA MEMORY_BOX_DB.CORE TO ROLE MEMORY_BOX_SERVICE_ROLE;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA MEMORY_BOX_DB.CORE TO ROLE MEMORY_BOX_SERVICE_ROLE;
```

### Secrets Management

```sql
-- Store authentication secrets securely
CREATE SECRET MEMORY_BOX_AUTH_CONFIG
  TYPE = GENERIC_STRING
  SECRET_STRING = '{"client_id": "your_client_id", "environment": "production"}'
  COMMENT = 'Memory Box authentication configuration';

-- Grant access to service role
GRANT USAGE ON SECRET MEMORY_BOX_AUTH_CONFIG TO ROLE MEMORY_BOX_SERVICE_ROLE;
```

### Permission Configuration

```sql
-- Grant Cortex AI permissions
GRANT USAGE ON DATABASE MEMORY_BOX_DB TO ROLE PUBLIC;
GRANT USAGE ON SCHEMA MEMORY_BOX_DB.CORE TO ROLE PUBLIC;
GRANT SELECT ON TABLE MEMORY_BOX_DB.CORE.MEMORIES TO ROLE PUBLIC;

-- Grant to SYSADMIN for Cortex Analyst
GRANT USAGE ON DATABASE MEMORY_BOX_DB TO ROLE SYSADMIN;
GRANT USAGE ON SCHEMA MEMORY_BOX_DB.CORE TO ROLE SYSADMIN;
GRANT SELECT ON TABLE MEMORY_BOX_DB.CORE.MEMORIES TO ROLE SYSADMIN;
```

## Phase 5: Validation and Testing

### Service Health Verification

```sql
-- Check service status
SHOW SERVICES;
DESCRIBE SERVICE MEMORY_BOX_BACKEND;
DESCRIBE SERVICE MEMORY_BOX_FRONTEND;

-- Get service endpoints
SELECT SYSTEM$GET_SERVICE_STATUS('MEMORY_BOX_FRONTEND');
SELECT SYSTEM$GET_SERVICE_STATUS('MEMORY_BOX_BACKEND');
```

### Functional Testing

**Backend API Testing**
```bash
# Test backend health endpoint
curl -X GET https://<backend-endpoint>/api/health

# Test Memory Box operations
curl -X POST https://<backend-endpoint>/api/memory/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test search", "limit": 5}'
```

**Frontend Interface Testing**
```bash
# Test frontend accessibility
curl -X GET https://<frontend-endpoint>/

# Test API proxy functionality
curl -X GET https://<frontend-endpoint>/api/health
```

### Integration Testing

**Memory Box Functionality**
1. **Memory Storage** - Test storing analytical insights
2. **Memory Retrieval** - Test searching for stored memories
3. **Vector Search** - Verify similarity search functionality
4. **Authentication** - Confirm user authentication works
5. **Data Access** - Test database exploration capabilities

**Cortex AI Integration**
1. **Claude Integration** - Test AI conversation capabilities
2. **Embedding Generation** - Verify vector embedding creation
3. **Cortex Analyst** - Test text-to-SQL functionality
4. **Tool Calling** - Confirm tool integration works

## Phase 6: Production Readiness

### Monitoring Setup

**Service Monitoring**
```sql
-- Monitor service performance
SELECT * FROM TABLE(INFORMATION_SCHEMA.SERVICE_USAGE_HISTORY(
  DATE_RANGE_START => DATEADD('day', -1, CURRENT_DATE()),
  DATE_RANGE_END => CURRENT_DATE(),
  SERVICE_NAME => 'MEMORY_BOX_FRONTEND'
));

-- Monitor compute pool usage
SELECT * FROM TABLE(INFORMATION_SCHEMA.COMPUTE_POOL_USAGE_HISTORY(
  DATE_RANGE_START => DATEADD('day', -1, CURRENT_DATE()),
  DATE_RANGE_END => CURRENT_DATE(),
  COMPUTE_POOL_NAME => 'MEMORY_BOX_BACKEND_POOL'
));
```

**Application Monitoring**
- Set up health check monitoring
- Configure error alerting
- Monitor Memory Box operation metrics
- Track user adoption and usage patterns

### Backup and Recovery

**Memory Box Data Backup**
```sql
-- Create backup schema
CREATE SCHEMA IF NOT EXISTS BACKUP;

-- Schedule regular backups
CREATE TASK BACKUP_MEMORIES
  WAREHOUSE = 'MEMORY_BOX_WAREHOUSE'
  SCHEDULE = 'USING CRON 0 2 * * * UTC'
AS
  CREATE OR REPLACE TABLE BACKUP.MEMORIES_BACKUP AS
  SELECT * FROM CORE.MEMORIES;

-- Start backup task
ALTER TASK BACKUP_MEMORIES RESUME;
```

### Performance Optimization

**Resource Tuning**
```sql
-- Adjust compute pool sizing based on usage
ALTER COMPUTE POOL MEMORY_BOX_BACKEND_POOL SET
  MIN_NODES = 2
  MAX_NODES = 8;

-- Optimize service scaling
ALTER SERVICE MEMORY_BOX_BACKEND SET
  MIN_INSTANCES = 2
  MAX_INSTANCES = 5;
```

## Deployment Checklist

### Pre-Deployment
- [ ] Snowflake account with SPCS enabled
- [ ] Required permissions and roles configured
- [ ] Cortex AI features enabled
- [ ] Infrastructure components created
- [ ] Container images built and pushed

### Deployment
- [ ] Backend service deployed successfully
- [ ] Frontend service deployed successfully
- [ ] Services are healthy and responding
- [ ] Authentication configured and tested
- [ ] Memory Box functionality validated

### Post-Deployment
- [ ] Monitoring and alerting configured
- [ ] Backup procedures implemented
- [ ] User access configured and tested
- [ ] Performance baseline established
- [ ] Documentation updated with deployment details

## Troubleshooting Common Issues

### Service Deployment Issues

**Service Won't Start**
- Check container image availability
- Verify compute pool has sufficient resources
- Review service logs for error messages
- Confirm environment variables are correct

**Authentication Failures**
- Verify OAuth configuration is correct
- Check that secrets are properly configured
- Confirm user has appropriate permissions
- Validate token generation and refresh

**Memory Box Operations Failing**
- Check Cortex AI permissions
- Verify database and table access
- Confirm vector operations are working
- Test embedding generation functionality

### Performance Issues

**Slow Response Times**
- Monitor compute pool utilization
- Check service resource allocation
- Review Memory Box query performance
- Consider scaling up resources

**High Resource Usage**
- Analyze service metrics
- Review Memory Box operation patterns
- Consider optimizing queries
- Adjust compute pool sizing

## Maintenance Procedures

### Regular Maintenance

**Weekly Tasks**
- Review service health and performance
- Check Memory Box storage growth
- Monitor user adoption metrics
- Review error logs and alerts

**Monthly Tasks**
- Analyze resource utilization trends
- Review and optimize compute pool sizing
- Update container images if needed
- Backup and archive old Memory Box data

### Update Procedures

**Container Updates**
1. Build new container versions
2. Test in staging environment
3. Deploy to production with rolling update
4. Validate functionality post-deployment
5. Monitor for issues and rollback if needed

**Configuration Updates**
1. Plan configuration changes
2. Test changes in staging
3. Apply changes during maintenance window
4. Validate configuration is working
5. Document changes for future reference

---

## Next Steps

- **Technical Considerations**: Review [Technical Considerations](./technical-considerations.md)
- **Analytics Transformation**: Learn about [Analytics Transformation](./analytics-transformation.md)
- **Architecture Details**: Explore [SPCS Production Architecture](./spcs-architecture.md)

*Successful deployment of Memory Box on Snowflake enables transformational analytics workflows with enterprise-grade security and performance.*
