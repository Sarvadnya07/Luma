use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::ids::DeviceId;

// ============================================================================
// Constants – default values
// ============================================================================

/// Default initial version number.
pub const INITIAL_VERSION: u64 = 1;

// ============================================================================
// EntityVersion
// ============================================================================

/// Monotonically increasing revision version counter.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct EntityVersion(pub u64);

impl EntityVersion {
    /// Returns the initial version (1).
    pub fn initial() -> Self {
        Self(INITIAL_VERSION)
    }

    /// Increments the version by 1.
    pub fn next(&self) -> Self {
        Self(self.0 + 1)
    }
}

impl Default for EntityVersion {
    fn default() -> Self {
        Self::initial()
    }
}

// ============================================================================
// VectorClock
// ============================================================================

/// Vector clock representation for distributed/multi-device causality tracking.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct VectorClock {
    pub clocks: BTreeMap<DeviceId, u64>,
}

impl VectorClock {
    /// Creates a new empty vector clock.
    pub fn new() -> Self {
        Self {
            clocks: BTreeMap::new(),
        }
    }

    /// Increments the counter for the given device.
    pub fn increment(&mut self, device_id: DeviceId) {
        let counter = self.clocks.entry(device_id).or_insert(0);
        *counter += 1;
    }

    /// Returns the counter value for the given device (0 if absent).
    pub fn get(&self, device_id: &DeviceId) -> u64 {
        self.clocks.get(device_id).copied().unwrap_or(0)
    }
}

// ============================================================================
// SyncMetadata
// ============================================================================

/// Metadata envelope for synchronizable entities.
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
    /// Creates a new metadata envelope with the current time and initial version.
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

    /// Marks the entity as updated, incrementing the version and updating the timestamp.
    pub fn mark_updated(&mut self, device_id: DeviceId) {
        self.version = self.version.next();
        self.updated_at = Utc::now();
        self.device_id = device_id;
    }

    /// Marks the entity as deleted, incrementing the version and setting deletion metadata.
    pub fn mark_deleted(&mut self, device_id: DeviceId) {
        self.version = self.version.next();
        let now = Utc::now();
        self.updated_at = now;
        self.device_id = device_id;
        self.is_deleted = true;
        self.deleted_at = Some(now);
    }

    /// Fluent setter for custom version (useful for testing).
    pub fn with_version(mut self, version: EntityVersion) -> Self {
        self.version = version;
        self
    }

    /// Fluent setter for custom timestamps.
    pub fn with_timestamps(mut self, created_at: DateTime<Utc>, updated_at: DateTime<Utc>) -> Self {
        self.created_at = created_at;
        self.updated_at = updated_at;
        self
    }

    /// Fluent setter for device ID.
    pub fn with_device(mut self, device_id: DeviceId) -> Self {
        self.device_id = device_id;
        self
    }

    /// Fluent setter for deletion state.
    pub fn with_deleted(mut self, is_deleted: bool) -> Self {
        self.is_deleted = is_deleted;
        if is_deleted && self.deleted_at.is_none() {
            self.deleted_at = Some(Utc::now());
        }
        self
    }
}
