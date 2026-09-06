use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

use crate::encoding::decode_text_bytes;
use crate::epub_doc::{ChapterContent, DocumentSearchMatch};
use crate::TocItem;
use luma_core::error::{LumaError, Result};
use luma_core::models::canonical::{
    DocumentPosition, DocumentRange, DocumentStructure, NodeKind, StructureNode,
};

/// Document engine for standalone plaintext files (.txt).
pub struct TextDocument {
    file_path: PathBuf,
    title: String,
    raw_text: String,
    html_content: String,
    toc: Vec<TocItem>,
    structure: DocumentStructure,
    paragraph_texts: Vec<String>,
}

impl TextDocument {
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path_ref = path.as_ref();
        let mut file = File::open(path_ref)
            .map_err(|e| LumaError::DocumentError(format!("Failed to open text file: {}", e)))?;

        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes)
            .map_err(|e| LumaError::DocumentError(format!("Failed to read text file: {}", e)))?;

        let raw_text = decode_text_bytes(&bytes);

        let fallback_title = path_ref
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Text Document")
            .replace(['_', '-'], " ");

        // Extract title from first non-empty line if short, otherwise fallback to filename
        let first_line = raw_text.lines().map(|l| l.trim()).find(|l| !l.is_empty());

        let title = match first_line {
            Some(l) if l.len() <= 80 => l.to_string(),
            _ => fallback_title,
        };

        // Render paragraphs into safe HTML and build structured nodes
        let mut html = String::with_capacity(raw_text.len() + 2048);
        html.push_str("<div class=\"reader-text-container font-serif text-lg leading-relaxed text-[#1C1917] dark:text-[#F5F1EA] max-w-2xl mx-auto px-6 py-12 space-y-4\">\n");

        let paragraphs: Vec<&str> = raw_text
            .split("\n\n")
            .map(|p| p.trim())
            .filter(|p| !p.is_empty())
            .collect();

        let mut structure_nodes = Vec::with_capacity(paragraphs.len());
        let mut paragraph_texts = Vec::with_capacity(paragraphs.len());
        let mut current_offset = 0;

        if paragraphs.is_empty() {
            html.push_str("<p class=\"reader-paragraph\" id=\"p0\"></p>\n");
            let p_node = StructureNode::new("p0", NodeKind::Paragraph { index: 0 })
                .with_text("")
                .with_range(DocumentRange::new(
                    DocumentPosition::new(0, 0),
                    DocumentPosition::new(0, 0),
                ));
            structure_nodes.push(p_node);
            paragraph_texts.push(String::new());
        } else {
            for (idx, p) in paragraphs.iter().enumerate() {
                paragraph_texts.push(p.to_string());
                let p_id = format!("p{}", idx);
                let p_char_len = p.chars().count();
                let start_pos = DocumentPosition::new(0, current_offset)
                    .with_node(&p_id)
                    .with_locator(format!("p{}", idx));
                let end_pos = DocumentPosition::new(0, current_offset + p_char_len)
                    .with_node(&p_id)
                    .with_locator(format!("p{}", idx));

                let p_node = StructureNode::new(&p_id, NodeKind::Paragraph { index: idx })
                    .with_text(*p)
                    .with_range(DocumentRange::new(start_pos, end_pos));
                structure_nodes.push(p_node);

                current_offset += p_char_len + 2; // account for newline separation

                html.push_str(&format!("<p class=\"reader-paragraph\" id=\"p{}\">", idx));
                // Escape HTML characters
                for ch in p.chars() {
                    match ch {
                        '&' => html.push_str("&amp;"),
                        '<' => html.push_str("&lt;"),
                        '>' => html.push_str("&gt;"),
                        '"' => html.push_str("&quot;"),
                        '\'' => html.push_str("&#39;"),
                        '\n' => html.push_str("<br />\n"),
                        _ => html.push(ch),
                    }
                }
                html.push_str("</p>\n");
            }
        }
        html.push_str("</div>\n");

        let toc = vec![TocItem {
            title: title.clone(),
            locator: "p0".to_string(),
            play_order: Some(1),
            children: Vec::new(),
        }];

        let root_node = StructureNode::new(
            "section-0",
            NodeKind::Section {
                index: 0,
                title: Some(title.clone()),
            },
        )
        .with_text(title.clone())
        .with_children(structure_nodes);

        let structure = DocumentStructure::new(root_node);

        Ok(Self {
            file_path: path_ref.to_path_buf(),
            title,
            raw_text,
            html_content: html,
            toc,
            structure,
            paragraph_texts,
        })
    }

    pub fn title(&self) -> &str {
        &self.title
    }

    pub fn spine_count(&self) -> usize {
        1
    }

    pub fn toc(&self) -> &[TocItem] {
        &self.toc
    }

    pub fn structure(&self) -> &DocumentStructure {
        &self.structure
    }

    pub fn get_paragraph(&self, idx: usize) -> Option<&str> {
        self.paragraph_texts.get(idx).map(|s| s.as_str())
    }

    pub fn get_range_text(&self, range: &DocumentRange) -> Result<String> {
        let chars: Vec<char> = self.raw_text.chars().collect();
        let start = range.start.char_offset.min(chars.len());
        let end = range.end.char_offset.min(chars.len());
        if start <= end {
            Ok(chars[start..end].iter().collect())
        } else {
            Ok(String::new())
        }
    }

    pub fn get_chapter(&self, spine_index: usize) -> Result<ChapterContent> {
        if spine_index != 0 {
            return Err(LumaError::NotFound {
                entity_type: "Chapter".to_string(),
                id: spine_index.to_string(),
            });
        }

        Ok(ChapterContent {
            spine_index: 0,
            id: "text_doc".to_string(),
            title: self.title.clone(),
            href: self
                .file_path
                .file_name()
                .map(|f| f.to_string_lossy().to_string())
                .unwrap_or_else(|| "text.txt".to_string()),
            html_content: self.html_content.clone(),
            text_content: self.raw_text.clone(),
        })
    }

    pub fn search(&self, query: &str) -> Result<Vec<DocumentSearchMatch>> {
        let q = query.trim().to_lowercase();
        if q.is_empty() {
            return Ok(Vec::new());
        }

        let lower_text = self.raw_text.to_lowercase();
        let mut matches = Vec::new();
        let mut start_idx = 0;

        while let Some(pos) = lower_text[start_idx..].find(&q) {
            let actual_pos = start_idx + pos;
            let snippet_start = actual_pos.saturating_sub(40);
            let snippet_end = (actual_pos + q.len() + 40).min(self.raw_text.len());

            let safe_start = self.raw_text.floor_char_boundary(snippet_start);
            let safe_end = self.raw_text.ceil_char_boundary(snippet_end);

            matches.push(DocumentSearchMatch {
                spine_index: 0,
                chapter_title: self.title.clone(),
                locator: format!("offset:{}", actual_pos),
                snippet: self.raw_text[safe_start..safe_end].to_string(),
                match_char_offset: actual_pos,
            });

            start_idx = actual_pos + q.len();
            if matches.len() >= 100 {
                break;
            }
        }

        Ok(matches)
    }
}
