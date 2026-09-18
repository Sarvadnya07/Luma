use std::fs;
use std::path::Path;

use luma_core::ids::DeviceId;

const DEVICE_ID_FILENAME: &str = "device_id";

/// Resolve the stable per-install device identity.
///
/// BACKEND-01 finding BE-002: the commands layer previously called
/// `DeviceId::new()` per operation, so `device_id` was a per-call stamp
/// rather than an identity. This resolves (or creates and persists) one
/// DeviceId per data directory at startup and returns it for all
/// subsequent operations.
pub fn load_or_create_device_id(data_dir: &Path) -> DeviceId {
    let path = data_dir.join(DEVICE_ID_FILENAME);

    if let Ok(existing) = fs::read_to_string(&path) {
        if let Ok(id) = existing.trim().parse::<DeviceId>() {
            return id;
        }
        tracing::warn!(
            file = %path.display(),
            "Stored device_id is unparseable; generating a new one"
        );
    }

    let id = DeviceId::new();
    if let Err(e) = fs::write(&path, id.to_string()) {
        tracing::warn!(
            file = %path.display(),
            error = %e,
            "Could not persist device_id; it will be regenerated next launch"
        );
    }
    id
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_then_reuses_device_id() {
        let dir =
            std::env::temp_dir().join(format!("luma-device-id-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();

        let first = load_or_create_device_id(&dir);
        let second = load_or_create_device_id(&dir);
        assert_eq!(first, second, "device id must be stable across loads");

        let stored = fs::read_to_string(dir.join(DEVICE_ID_FILENAME)).unwrap();
        assert_eq!(stored.trim(), first.to_string());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn regenerates_on_corrupt_file() {
        let dir =
            std::env::temp_dir().join(format!("luma-device-id-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join(DEVICE_ID_FILENAME), "not-a-uuid").unwrap();

        let id = load_or_create_device_id(&dir);
        assert_ne!(id.to_string(), "not-a-uuid");
        let stored = fs::read_to_string(dir.join(DEVICE_ID_FILENAME)).unwrap();
        assert_eq!(
            stored.trim(),
            id.to_string(),
            "corrupt value must be repaired"
        );
        std::fs::remove_dir_all(&dir).ok();
    }
}
