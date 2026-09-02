use serde_json::Value;
use std::collections::HashMap;
use tauri::State;
use tracing::{debug, error, info, instrument};

use crate::context::LumaAppContext;
use luma_core::error::BackendError;

// ============================================================================
// Constants – centralised messages
// ============================================================================

const INVALID_KEY_MSG: &str = "Setting key cannot be empty.";
const SETTING_RETRIEVED_MSG: &str = "Setting retrieved successfully.";
const SETTING_UPDATED_MSG: &str = "Setting updated successfully.";
const ALL_SETTINGS_RETRIEVED_MSG: &str = "All settings retrieved successfully.";
const SETTING_NOT_FOUND_MSG: &str = "Setting not found.";

// ============================================================================
// Helper Functions
// ============================================================================

/// Validates that a setting key is not empty.
fn validate_key(key: &str) -> Result<(), BackendError> {
    if key.trim().is_empty() {
        return Err(BackendError::validation(INVALID_KEY_MSG));
    }
    Ok(())
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[instrument(skip(ctx), fields(key = %key))]
#[tauri::command]
pub fn get_setting(
    ctx: State<'_, LumaAppContext>,
    key: String,
) -> Result<Option<Value>, BackendError> {
    validate_key(&key)?;
    debug!(?key, "Retrieving setting");

    let value = ctx
        .settings_service
        .get_setting(&key)
        .map_err(|e| {
            error!(error = %e, "Failed to get setting");
            BackendError::from(e)
        })?;

    if value.is_some() {
        debug!(?value, SETTING_RETRIEVED_MSG);
    } else {
        debug!(SETTING_NOT_FOUND_MSG);
    }
    Ok(value)
}

#[instrument(skip(ctx, value), fields(key = %key, value = ?value))]
#[tauri::command]
pub fn set_setting(
    ctx: State<'_, LumaAppContext>,
    key: String,
    value: Value,
) -> Result<(), BackendError> {
    validate_key(&key)?;
    debug!(?key, ?value, "Setting value");

    ctx.settings_service
        .set_setting(&key, &value)
        .map_err(|e| {
            error!(error = %e, "Failed to set setting");
            BackendError::from(e)
        })?;

    info!(SETTING_UPDATED_MSG);
    Ok(())
}

#[instrument(skip(ctx))]
#[tauri::command]
pub fn get_all_settings(
    ctx: State<'_, LumaAppContext>,
) -> Result<HashMap<String, Value>, BackendError> {
    debug!("Retrieving all settings");

    let settings = ctx
        .settings_service
        .get_all_settings()
        .map_err(|e| {
            error!(error = %e, "Failed to get all settings");
            BackendError::from(e)
        })?;

    debug!(count = settings.len(), ALL_SETTINGS_RETRIEVED_MSG);
    Ok(settings)
}