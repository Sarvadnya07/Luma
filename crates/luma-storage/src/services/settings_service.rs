use serde_json::Value;
use std::collections::HashMap;

use crate::db::Database;
use crate::events::{DomainEvent, EventBus};
use crate::repos::SettingsRepository;
use luma_core::error::{LumaError, Result};

#[derive(Clone)]
pub struct SettingsService {
    repo: SettingsRepository,
    event_bus: EventBus,
}

impl SettingsService {
    pub fn new(db: Database, event_bus: EventBus) -> Self {
        let repo = SettingsRepository::new(db);
        Self { repo, event_bus }
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<Value>> {
        self.repo
            .get_setting(key)
            .map_err(|e| LumaError::StorageError(e.to_string()))
    }

    pub fn set_setting(&self, key: &str, value: &Value) -> Result<()> {
        self.repo
            .set_setting(key, value)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        self.event_bus.publish(DomainEvent::SettingsChanged {
            key: key.to_string(),
        });

        Ok(())
    }

    pub fn get_all_settings(&self) -> Result<HashMap<String, Value>> {
        self.repo
            .get_all_settings()
            .map_err(|e| LumaError::StorageError(e.to_string()))
    }
}
