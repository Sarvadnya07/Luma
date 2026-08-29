use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::ids::DeviceId;

/// Monotonically increasing revision version counter
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct EntityVersion(pub u64);

impl EntityVersion {
    pub fn initial() -> Self {
        Self(1)
    }

    pub fn next(&self) -> Self {
        Self(self.0 + 1)
    }
}

impl Default for EntityVersion {
    fn default() -> Self {
        Self::initial()
    }
}

/// Vector clock representation for distributed/multi-device causality tracking
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct VectorClock {
    pub clocks: BTreeMap<DeviceId, u64>,
}

impl VectorClock {
    pub fn new() -> Self {
        Self {
            clocks: BTreeMap::new(),
        }
    }

    pub fn increment(&mut self, device_id: DeviceId) {
        let counter = self.clocks.entry(device_id).or_insert(0);
        *counter += 1;
    }

    pub fn get(&self, device_id: &DeviceId) -> u64 {
        self.clocks.get(device_id).copied().unwrap_or(0)
    }
}

/// Metadata envelope for synchronizable entities
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SyncMetadata {
    pub version: EntityVersion,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub device_id: DeviceId,
    pub is_deleted: bool,
    pub deleted_at: Option<DateTime<Utc>>,
}

impl SyncMetadata {
    pub fn new(device_id: DeviceId) -> Self {
        let now = Utc::now();
        Self {
            version: EntityVersion::initial(),
            created_at: now,
            updated_at: now,
            device_id,
            is_deleted: false,
            deleted_at: None,
        }
    }

    pub fn mark_updated(&mut self, device_id: DeviceId) {
        self.version = self.version.next();
        self.updated_at = Utc::now();
        self.device_id = device_id;
    }

    pub fn mark_deleted(&mut self, device_id: DeviceId) {
        self.version = self.version.next();
        let now = Utc::now();
        self.updated_at = now;
        self.device_id = device_id;
        self.is_deleted = true;
        self.deleted_at = Some(now);
    }
}
