use async_trait::async_trait;
use luma_core::error::{Result, LumaError};
use serde::{Deserialize, Serialize};


// ============================================================================
// Constants – centralised defaults
// ============================================================================

const DEFAULT_PROVIDER_NAME: &str = "local-llama";
const DEFAULT_MODEL_ID: &str = "llama-3-8b-instruct";
const DEFAULT_MAX_TOKENS: u32 = 1024;
const DEFAULT_TEMPERATURE: u32 = 70; // 0-100 scale
const DEFAULT_MAX_LENGTH_WORDS: u32 = 300;

// ============================================================================
// Configuration
// ============================================================================

/// Configuration for an AI provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiProviderConfig {
    pub provider_name: String,
    pub model_id: String,
    pub max_tokens: Option<u32>,
    pub temperature: Option<u32>, // 0-100 scaled integer
    pub max_summary_words: u32,
}

impl Default for AiProviderConfig {
    fn default() -> Self {
        Self {
            provider_name: DEFAULT_PROVIDER_NAME.to_string(),
            model_id: DEFAULT_MODEL_ID.to_string(),
            max_tokens: Some(DEFAULT_MAX_TOKENS),
            temperature: Some(DEFAULT_TEMPERATURE),
            max_summary_words: DEFAULT_MAX_LENGTH_WORDS,
        }
    }
}

impl AiProviderConfig {
    /// Create a new configuration from environment variables.
    pub fn from_env() -> Self {
        Self {
            provider_name: std::env::var("LUMA_AI_PROVIDER")
                .unwrap_or_else(|_| DEFAULT_PROVIDER_NAME.to_string()),
            model_id: std::env::var("LUMA_AI_MODEL")
                .unwrap_or_else(|_| DEFAULT_MODEL_ID.to_string()),
            max_tokens: std::env::var("LUMA_AI_MAX_TOKENS")
                .ok()
                .and_then(|v| v.parse().ok()),
            temperature: std::env::var("LUMA_AI_TEMPERATURE")
                .ok()
                .and_then(|v| v.parse().ok()),
            max_summary_words: std::env::var("LUMA_AI_MAX_SUMMARY_WORDS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(DEFAULT_MAX_LENGTH_WORDS),
        }
    }
}

// ============================================================================
// Request/Response Models
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SummaryRequest {
    pub document_title: String,
    pub section_text: String,
    pub max_length_words: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SummaryResponse {
    pub summary_text: String,
    pub key_takeaways: Vec<String>,
}

// ============================================================================
// AI Provider Trait
// ============================================================================

/// Abstract AI Provider interface (Phase 1 boundary only - no live implementation).
/// This trait defines the core capabilities required from any AI service.
#[async_trait]
pub trait AiProvider: Send + Sync {
    /// Generate a concise summary for the given document section.
    async fn generate_summary(&self, request: &SummaryRequest) -> Result<SummaryResponse>;

    /// Generate dense vector embeddings for a batch of texts.
    async fn generate_embeddings(&self, texts: &[String]) -> Result<Vec<Vec<f32>>>;
}

// ============================================================================
// Helper Utilities
// ============================================================================

/// Validate that a request has non‑empty fields.
pub fn validate_summary_request(req: &SummaryRequest) -> Result<()> {
    if req.document_title.trim().is_empty() {
        return Err(LumaError::ValidationError("Document title cannot be empty".to_string()));
    }
    if req.section_text.trim().is_empty() {
        return Err(LumaError::ValidationError("Section text cannot be empty".to_string()));
    }
    Ok(())
}


// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_config_default() {
        let config = AiProviderConfig::default();
        assert_eq!(config.provider_name, DEFAULT_PROVIDER_NAME);
        assert_eq!(config.model_id, DEFAULT_MODEL_ID);
        assert_eq!(config.max_tokens, Some(DEFAULT_MAX_TOKENS));
        assert_eq!(config.temperature, Some(DEFAULT_TEMPERATURE));
        assert_eq!(config.max_summary_words, DEFAULT_MAX_LENGTH_WORDS);
    }

    #[test]
    fn test_model_config_from_env() {
        // Temporarily set environment variables for testing
        std::env::set_var("LUMA_AI_PROVIDER", "test-provider");
        std::env::set_var("LUMA_AI_MODEL", "test-model");
        std::env::set_var("LUMA_AI_MAX_TOKENS", "2048");
        std::env::set_var("LUMA_AI_TEMPERATURE", "50");
        std::env::set_var("LUMA_AI_MAX_SUMMARY_WORDS", "500");

        let config = AiProviderConfig::from_env();
        assert_eq!(config.provider_name, "test-provider");
        assert_eq!(config.model_id, "test-model");
        assert_eq!(config.max_tokens, Some(2048));
        assert_eq!(config.temperature, Some(50));
        assert_eq!(config.max_summary_words, 500);

        // Clean up
        std::env::remove_var("LUMA_AI_PROVIDER");
        std::env::remove_var("LUMA_AI_MODEL");
        std::env::remove_var("LUMA_AI_MAX_TOKENS");
        std::env::remove_var("LUMA_AI_TEMPERATURE");
        std::env::remove_var("LUMA_AI_MAX_SUMMARY_WORDS");
    }

    #[test]
    fn test_validate_summary_request() {
        let valid = SummaryRequest {
            document_title: "Test Title".to_string(),
            section_text: "Some text content".to_string(),
            max_length_words: None,
        };
        assert!(validate_summary_request(&valid).is_ok());

        let invalid = SummaryRequest {
            document_title: "".to_string(),
            section_text: "Text".to_string(),
            max_length_words: None,
        };
        assert!(validate_summary_request(&invalid).is_err());
    }
}