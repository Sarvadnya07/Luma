use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;
use uuid::Uuid;

use crate::error::LumaError;



// ============================================================================
// ID Macro
// ============================================================================

/// Defines a newtype wrapper around `Uuid` with a given prefix for display and parsing.
///
/// # Example
/// ```rust,ignore
/// define_id!(BookId, "book");
/// let id = BookId::new();
/// assert_eq!(id.to_string(), format!("book_{}", id.as_uuid().simple()));
/// ```
macro_rules! define_id {

    ($name:ident, $prefix:literal) => {
        #[derive(
            Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize,
        )]
        #[serde(transparent)]
        pub struct $name(pub Uuid);

        impl $name {
            /// Generate a new unique time-ordered ID (UUID v7).
            pub fn new() -> Self {
                Self(Uuid::now_v7())
            }

            /// Wrap an existing UUID.
            pub fn from_uuid(uuid: Uuid) -> Self {
                Self(uuid)
            }

            /// Retrieve the underlying UUID.
            pub fn as_uuid(&self) -> &Uuid {
                &self.0
            }
        }

        impl Default for $name {
            fn default() -> Self {
                Self::new()
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                write!(f, "{}_{}", $prefix, self.0.simple())
            }
        }

        impl FromStr for $name {
            type Err = LumaError;

            fn from_str(s: &str) -> Result<Self, Self::Err> {
                let trimmed = if let Some(stripped) = s.strip_prefix(concat!($prefix, "_")) {
                    stripped
                } else {
                    s
                };

                Uuid::parse_str(trimmed)
                    .map(Self)
                    .map_err(|e| LumaError::InvalidId(format!("Invalid ID format for {}: {}", stringify!($name), e)))
            }

        }

        impl From<Uuid> for $name {
            fn from(u: Uuid) -> Self {
                Self(u)
            }
        }
    };
}

// ============================================================================
// ID Definitions
// ============================================================================

define_id!(BookId, "book");
define_id!(FileId, "file");
define_id!(AuthorId, "auth");
define_id!(SeriesId, "ser");
define_id!(TagId, "tag");
define_id!(CollectionId, "col");
define_id!(AnnotationId, "ann");
define_id!(BookmarkId, "bmk");
define_id!(DeviceId, "dev");
define_id!(SessionId, "sess");
define_id!(ChangeRecordId, "cr");
define_id!(CoverImageId, "cov");
define_id!(ImportJobId, "job");

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_id_generation_and_formatting() {
        let book_id = BookId::new();
        let formatted = book_id.to_string();
        assert!(formatted.starts_with("book_"));

        let parsed: BookId = formatted.parse().expect("should parse correctly");
        assert_eq!(book_id, parsed);
    }

    #[test]
    fn test_parse_plain_uuid() {
        let raw_uuid = Uuid::now_v7();
        let s = raw_uuid.to_string();
        let ann_id: AnnotationId = s.parse().expect("should parse plain uuid");
        assert_eq!(ann_id.0, raw_uuid);
    }

    #[test]
    fn test_invalid_id() {
        let err = "invalid-uuid-string".parse::<BookId>();
        assert!(err.is_err());
    }
}   