use crate::db::Database;
use crate::error::StorageResult;
use rusqlite::params;
use serde_json::Value;

#[derive(Clone)]
pub struct SettingsRepository {
    db: Database,
}

impl SettingsRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn get_setting(&self, key: &str) -> StorageResult<Option<Value>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare("SELECT value_json FROM settings WHERE key = ?1")?;
            let mut rows = stmt.query([key])?;
            if let Some(row) = rows.next()? {
                let json_str: String = row.get(0)?;
                let val: Value = serde_json::from_str(&json_str).unwrap_or(Value::Null);
                Ok(Some(val))
            } else {
                Ok(None)
            }
        })
    }

    pub fn set_setting(&self, key: &str, value: &Value) -> StorageResult<()> {
        let json_str = serde_json::to_string(value).unwrap_or_else(|_| "{}".to_string());
        self.db.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO settings (key, value_json, updated_at)
                VALUES (?1, ?2, datetime('now'))
                ON CONFLICT(key) DO UPDATE SET
                    value_json = excluded.value_json,
                    updated_at = datetime('now')
                "#,
                params![key, json_str],
            )?;
            Ok(())
        })
    }

    pub fn get_all_settings(&self) -> StorageResult<std::collections::HashMap<String, Value>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare("SELECT key, value_json FROM settings")?;
            let rows = stmt.query_map([], |r| {
                let k: String = r.get(0)?;
                let v_str: String = r.get(1)?;
                let v: Value = serde_json::from_str(&v_str).unwrap_or(Value::Null);
                Ok((k, v))
            })?;

            let mut map = std::collections::HashMap::new();
            for item in rows.flatten() {
                map.insert(item.0, item.1);
            }
            Ok(map)
        })
    }
}
