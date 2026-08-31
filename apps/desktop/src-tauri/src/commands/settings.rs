use serde_json::Value;
use std::collections::HashMap;
use tauri::State;

use crate::context::LumaAppContext;
use luma_core::error::BackendError;

#[tauri::command]
pub fn get_setting(
    ctx: State<'_, LumaAppContext>,
    key: String,
) -> Result<Option<Value>, BackendError> {
    ctx.settings_service
        .get_setting(&key)
        .map_err(BackendError::from)
}

#[tauri::command]
pub fn set_setting(
    ctx: State<'_, LumaAppContext>,
    key: String,
    value: Value,
) -> Result<(), BackendError> {
    ctx.settings_service
        .set_setting(&key, &value)
        .map_err(BackendError::from)
}

#[tauri::command]
pub fn get_all_settings(
    ctx: State<'_, LumaAppContext>,
) -> Result<HashMap<String, Value>, BackendError> {
    ctx.settings_service
        .get_all_settings()
        .map_err(BackendError::from)
}
