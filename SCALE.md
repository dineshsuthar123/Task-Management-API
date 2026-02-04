# Scaling the Task Management API

This document outlines strategies to scale the Task Management API from a single-server deployment to a high-availability, distributed system capable of handling millions of users.

## Table of Contents
1. [Current Architecture](#current-architecture)
2. [Horizontal Scaling](#horizontal-scaling)
3. [Database Scaling](#database-scaling)
4. [Caching Strategy](#caching-strategy)
5. [Load Balancing](#load-balancing)
6. [Microservices Architecture](#microservices-architecture)
7. [Performance Optimization](#performance-optimization)
8. [Monitoring & Observability](#monitoring--observability)

---

## 1. Current Architecture

**Single Server Setup:**
- Node.js Express application
- PostgreSQL database
- Single instance deployment
- In-memory session/cache

**Limitations:**
- Single point of failure
- Limited concurrent connections (~10K)
- Vertical scaling only
- No fault tolerance

---

## 2. Horizontal Scaling

### Application Layer

**Stateless API Servers:**
```
[Load Balancer]
    ├── [API Server 1]
    ├── [API Server 2]
    ├── [API Server 3]
    └── [API Server N]
```

**Implementation Steps:**

1. **Remove Server State:**
   - Move sessions to Redis/external store
   - Use JWT for stateless authentication (already implemented)
   - Externalize file uploads to S3/object storage

2. **Container Orchestration:**
   ```yaml
   # docker-compose-scaled.yml
   services:
     api:
       image: task-api:latest
       deploy:
         replicas: 5
         resources:
           limits:
             cpus: '0.5'
             memory: 512M
   ```

3. **Kubernetes Deployment:**
   ```yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: task-api
   spec:
     replicas: 5
     selector:
       matchLabels:
         app: task-api
     template:
       metadata:
         labels:
           app: task-api
       spec:
         containers:
         - name: api
           image: task-api:latest
           resources:
             requests:
               memory: "256Mi"
               cpu: "250m"
             limits:
               memory: "512Mi"
               cpu: "500m"
   ```

---

## 3. Database Scaling

### Read Replicas (Phase 1)

```
[Write Master]
    ├── [Read Replica 1]
    ├── [Read Replica 2]
    └── [Read Replica 3]
```

**Prisma Configuration:**
```typescript
// config/database.ts
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL, // Write master
    },
  },
});

// For read-heavy operations
const prismaRead = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_READ_URL, // Read replica
    },
  },
});

// Usage in services
export class TaskService {
  async getTasks(userId: string, params: PaginationParams) {
    // Use read replica for GET operations
    const tasks = await prismaRead.task.findMany({...});
    return tasks;
  }

  async createTask(userId: string, data: CreateTaskDTO) {
    // Use master for writes
    return prisma.task.create({...});
  }
}
```

### Connection Pooling

**Current Settings (Prisma):**
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/taskdb?schema=public&connection_limit=10"
```

**Scaled Settings:**
```env
# Production settings
DATABASE_URL="postgresql://user:pass@db:5432/taskdb?schema=public&connection_limit=100&pool_timeout=10&connect_timeout=10"
```

**PgBouncer for Connection Pooling:**
```ini
# pgbouncer.ini
[databases]
taskdb = host=postgres port=5432 dbname=taskdb

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
reserve_pool_size = 5
```

### Partitioning (Phase 2)

**Horizontal Partitioning by User:**
```sql
-- Partition tasks table by userId hash
CREATE TABLE tasks_partition_0 PARTITION OF tasks
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);

CREATE TABLE tasks_partition_1 PARTITION OF tasks
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);

CREATE TABLE tasks_partition_2 PARTITION OF tasks
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);

CREATE TABLE tasks_partition_3 PARTITION OF tasks
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

### Sharding (Phase 3)

```
[Shard Router]
    ├── [Shard 1: Users A-F]
    ├── [Shard 2: Users G-M]
    ├── [Shard 3: Users N-S]
    └── [Shard 4: Users T-Z]
```

---

## 4. Caching Strategy

### Redis Implementation

**Layer 1: Application Cache**
```typescript
// config/redis.ts
import Redis from 'ioredis';

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

// middleware/cache.ts
export const cacheMiddleware = (ttl: number = 300) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const key = `cache:${req.user!.id}:${req.originalUrl}`;
    
    const cached = await redis.get(key);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Override res.json to cache response
    const originalJson = res.json.bind(res);
    res.json = (data: any) => {
      redis.setex(key, ttl, JSON.stringify(data));
      return originalJson(data);
    };

    next();
  };
};

// Usage in routes
router.get('/', 
  authenticate, 
  cacheMiddleware(300), // 5 min cache
  taskController.getTasks
);
```

**Layer 2: Session Store**
```typescript
// Store JWT refresh tokens in Redis
export class AuthService {
  async generateRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await redis.setex(
      `refresh:${userId}`,
      60 * 60 * 24 * 30, // 30 days
      token
    );
    return token;
  }
}
```

**Cache Invalidation:**
```typescript
export class TaskService {
  async createTask(userId: string, data: CreateTaskDTO) {
    const task = await prisma.task.create({...});
    
    // Invalidate user's task list cache
    await redis.del(`cache:${userId}:/v1/tasks*`);
    
    return task;
  }
}
```

---

## 5. Load Balancing

### NGINX Configuration

```nginx
# nginx.conf
upstream task_api {
    least_conn;  # Connection-based balancing
    
    server api-1:3000 max_fails=3 fail_timeout=30s;
    server api-2:3000 max_fails=3 fail_timeout=30s;
    server api-3:3000 max_fails=3 fail_timeout=30s;
    
    keepalive 32;
}

server {
    listen 80;
    server_name api.taskapp.com;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req zone=api_limit burst=20 nodelay;

    location / {
        proxy_pass http://task_api;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://task_api/health;
    }
}
```

### AWS Application Load Balancer

```terraform
# terraform/alb.tf
resource "aws_lb" "api" {
  name               = "task-api-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = true
  enable_http2               = true
}

resource "aws_lb_target_group" "api" {
  name     = "task-api-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    interval            = 30
    path                = "/health"
    port                = "traffic-port"
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 5
    matcher             = "200"
  }

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400
    enabled         = false  # Stateless API
  }
}
```

---

## 6. Microservices Architecture

### Service Decomposition

```
[API Gateway] (Kong/AWS API Gateway)
    ├── [Auth Service] - User authentication
    ├── [Task Service] - Task CRUD operations
    ├── [User Service] - User management
    └── [Notification Service] - Email/push notifications
```

**Split Current Monolith:**

**1. Auth Service**
```typescript
// auth-service/src/index.ts
// Handles: /v1/auth/*
// Database: users table
// Dependencies: None
```

**2. Task Service**
```typescript
// task-service/src/index.ts
// Handles: /v1/tasks/*
// Database: tasks table
// Dependencies: Auth Service (for token validation)
// Events: Publishes "task.created", "task.updated"
```

**3. Event-Driven Communication**
```typescript
// Using RabbitMQ or AWS SQS
import amqp from 'amqplib';

// Task service publishes events
export class TaskService {
  async createTask(userId: string, data: CreateTaskDTO) {
    const task = await prisma.task.create({...});
    
    // Publish event
    await publishEvent('task.created', {
      taskId: task.id,
      userId,
      title: task.title,
    });
    
    return task;
  }
}

// Notification service consumes events
async function consumeTaskEvents() {
  const connection = await amqp.connect('amqp://rabbitmq');
  const channel = await connection.createChannel();
  
  await channel.assertQueue('task.created');
  channel.consume('task.created', async (msg) => {
    const event = JSON.parse(msg!.content.toString());
    await sendNotification(event.userId, `Task "${event.title}" created`);
    channel.ack(msg!);
  });
}
```

---

## 7. Performance Optimization

### Database Indexes

```sql
-- Critical indexes for performance
CREATE INDEX idx_tasks_user_id ON tasks(userId);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_at ON tasks(createdAt DESC);
CREATE INDEX idx_users_email ON users(email);

-- Composite index for common queries
CREATE INDEX idx_tasks_user_status_created 
    ON tasks(userId, status, createdAt DESC);
```

### Query Optimization

```typescript
// Bad: N+1 query problem
async getAllTasksWithUsers() {
  const tasks = await prisma.task.findMany();
  for (const task of tasks) {
    task.user = await prisma.user.findUnique({ where: { id: task.userId } });
  }
}

// Good: Single query with join
async getAllTasksWithUsers() {
  return prisma.task.findMany({
    include: {
      user: {
        select: { id: true, email: true, role: true }
      }
    }
  });
}
```

### Rate Limiting (Distributed)

```typescript
// Use Redis for distributed rate limiting
import { RateLimiterRedis } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'ratelimit',
  points: 10, // Number of points
  duration: 1, // Per second
  blockDuration: 60, // Block for 1 minute
});

export const distributedRateLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch {
    res.status(429).json({ error: 'Too many requests' });
  }
};
```

---

## 8. Monitoring & Observability

### Logging (Centralized)

```typescript
// config/logger.ts - Updated for production
import winston from 'winston';
import { LogstashTransport } from 'winston-logstash-transport';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: {
    service: 'task-api',
    environment: process.env.NODE_ENV,
  },
  transports: [
    new LogstashTransport({
      host: 'logstash',
      port: 5000,
    }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
});
```

### Metrics (Prometheus)

```typescript
// middleware/metrics.ts
import promClient from 'prom-client';

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
});

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode.toString())
      .observe(duration);
  });
  
  next();
};

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});
```

### Tracing (Jaeger/OpenTelemetry)

```typescript
// config/tracing.ts
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

const provider = new NodeTracerProvider();
const exporter = new JaegerExporter({
  serviceName: 'task-api',
  endpoint: 'http://jaeger:14268/api/traces',
});

provider.addSpanProcessor(
  new BatchSpanProcessor(exporter)
);
provider.register();
```

---

## Scaling Roadmap

### Phase 1: Single Region (0-100K users)
- ✅ Stateless API design
- ✅ Database connection pooling
- ✅ Basic caching (Redis)
- ✅ Load balancer (NGINX)
- ✅ Horizontal scaling (3-5 API servers)

### Phase 2: Optimized Single Region (100K-1M users)
- ⚙️ Read replicas (3-5 replicas)
- ⚙️ Advanced caching strategies
- ⚙️ CDN for static assets
- ⚙️ Database partitioning
- ⚙️ Async job processing (Bull/RabbitMQ)

### Phase 3: Multi-Region (1M-10M users)
- 🔜 Database sharding
- 🔜 Microservices architecture
- 🔜 Event-driven communication
- 🔜 Multi-region deployment
- 🔜 Global load balancing (AWS Route53/Cloudflare)

### Phase 4: Global Scale (10M+ users)
- 🔜 Service mesh (Istio)
- 🔜 Multi-cloud deployment
- 🔜 Advanced monitoring & alerting
- 🔜 Chaos engineering
- 🔜 Auto-scaling based on metrics

---

## Cost Optimization

### AWS Cost Estimates (Phase 2)

| Component | Specs | Monthly Cost (USD) |
|-----------|-------|-------------------|
| EC2 (API servers) | 3x t3.medium | $90 |
| RDS PostgreSQL | db.t3.large | $140 |
| ElastiCache Redis | cache.t3.small | $30 |
| ALB | Standard | $20 |
| CloudWatch | Logs + Metrics | $15 |
| **Total** | | **$295/month** |

### Optimization Tips
- Use Reserved Instances (40% savings)
- Implement auto-scaling (scale down during off-peak)
- Use S3 for logs instead of CloudWatch
- Compress database backups
- Use spot instances for non-critical workloads

---

## Conclusion

This scaling strategy provides a clear path from prototype to production-grade infrastructure. Each phase builds upon the previous, allowing incremental investment aligned with growth.

**Key Takeaways:**
1. Start stateless for easy horizontal scaling
2. Cache aggressively at multiple layers
3. Database is usually the bottleneck - plan early
4. Monitor everything before optimizing
5. Automate deployments for consistency

**Next Steps:**
1. Implement Redis caching (immediate wins)
2. Set up monitoring (Prometheus + Grafana)
3. Create load testing suite (k6/Artillery)
4. Document runbooks for common scenarios
