-- Create cache_invalidation_logs table
-- This table tracks all cache invalidation operations for audit trail

CREATE TABLE IF NOT EXISTS cache_invalidation_logs (
    id VARCHAR(36) PRIMARY KEY,
    admin_id INTEGER,
    admin_name VARCHAR(255),
    action VARCHAR(50) NOT NULL,
    cache_groups JSONB,
    redis_patterns JSONB,
    keys_deleted INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    error_message TEXT,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_admin_id_timestamp ON cache_invalidation_logs(admin_id, created_at);
CREATE INDEX IF NOT EXISTS idx_action_timestamp ON cache_invalidation_logs(action, created_at);
CREATE INDEX IF NOT EXISTS idx_status ON cache_invalidation_logs(status);
CREATE INDEX IF NOT EXISTS idx_admin_id ON cache_invalidation_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_action ON cache_invalidation_logs(action);
CREATE INDEX IF NOT EXISTS idx_created_at ON cache_invalidation_logs(created_at);
