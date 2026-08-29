use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use luma_core::error::Result;
use luma_core::ids::{ChangeRecordId, DeviceId};
use luma_core::version::EntityVersion;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OperationType {
    Insert,
    Update,
    Delete,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChangeRecord {
    pub id: ChangeRecordId,
    pub entity_type: String,
    pub entity_id: String,
    pub version: EntityVersion,
    pub device_id: DeviceId,
    pub operation: OperationType,
    pub payload_json: String,
    pub occurred_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SyncBatch {
    pub source_device_id: DeviceId,
    pub changes: Vec<ChangeRecord>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConflictResolutionStrategy {
    LastWriteWins,
    DevicePriority,
    ManualReviewRequired,
}

/// Abstract sync provider trait
#[async_trait]
pub trait SyncProvider: Send + Sync {
    async fn pull_changes(&self, since_version: u64) -> Result<SyncBatch>;
    async fn push_changes(&self, batch: &SyncBatch) -> Result<()>;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_change_record_creation() {
        let cr = ChangeRecord {
            id: ChangeRecordId::new(),
            entity_type: "annotation".to_string(),
            entity_id: "ann_123".to_string(),
            version: EntityVersion::initial(),
            device_id: DeviceId::new(),
            operation: OperationType::Insert,
            payload_json: "{}".to_string(),
            occurred_at: Utc::now(),
        };
        assert_eq!(cr.operation, OperationType::Insert);
    }
}
