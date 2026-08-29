use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use luma_core::error::Result;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModelConfig {
    pub provider_name: String,
    pub model_id: String,
    pub max_tokens: Option<u32>,
    pub temperature: Option<u32>, // Stored as scaled integer (0-100)
}

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

/// Abstract AI Provider interface (Phase 1 boundary only - no live implementation)
#[async_trait]
pub trait AiProvider: Send + Sync {
    async fn generate_summary(&self, request: &SummaryRequest) -> Result<SummaryResponse>;
    async fn generate_embeddings(&self, texts: &[String]) -> Result<Vec<Vec<f32>>>;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_config() {
        let config = ModelConfig {
            provider_name: "local-llama".to_string(),
            model_id: "llama-3-8b-instruct".to_string(),
            max_tokens: Some(1024),
            temperature: Some(70),
        };
        assert_eq!(config.provider_name, "local-llama");
    }
}
