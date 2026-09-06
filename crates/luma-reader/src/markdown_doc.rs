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
use luma_security::sanitize_untrusted_html;

/// Document engine for standalone Markdown files (.md).
pub struct MarkdownDocument {
    file_path: PathBuf,
    title: String,
    raw_text: String,
    html_content: String,
    toc: Vec<TocItem>,
    structure: DocumentStructure,
    paragraph_texts: Vec<String>,
}

impl MarkdownDocument {
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path_ref = path.as_ref();
        let mut file = File::open(path_ref).map_err(|e| {
            LumaError::DocumentError(format!("Failed to open markdown file: {}", e))
        })?;

        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes).map_err(|e| {
            LumaError::DocumentError(format!("Failed to read markdown file: {}", e))
        })?;

        let raw_bytes_text = decode_text_bytes(&bytes);
        let raw_text = sanitize_untrusted_html(&raw_bytes_text);

        let fallback_title = path_ref
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Markdown Document")
            .replace(['_', '-'], " ");

        // Check YAML frontmatter or first # H1 for title
        let mut title = None;
        let mut text_body = raw_text.as_str();

        if let Some(stripped) = raw_text.strip_prefix("---") {
            if let Some(end_idx) = stripped.find("---") {
                let frontmatter = &stripped[..end_idx];
                for line in frontmatter.lines() {
                    let trimmed = line.trim();
                    if let Some(val) = trimmed.strip_prefix("title:") {
                        title = Some(val.trim().trim_matches('"').trim_matches('\'').to_string());
                        break;
                    }
                }
                text_body = stripped[end_idx + 3..].trim_start();
            }
        }

        let mut toc = Vec::new();
        let mut heading_count = 0;

        // Render Markdown lines to HTML
        let mut html = String::with_capacity(text_body.len() * 2);
        html.push_str("<div class=\"reader-markdown-container font-serif text-lg leading-relaxed text-[#1C1917] dark:text-[#F5F1EA] max-w-2xl mx-auto px-6 py-12 space-y-4\">\n");

        let mut structure_nodes = Vec::new();
        let mut paragraph_texts = Vec::new();
        let mut current_offset = 0;

        let mut in_code_block = false;
        let mut code_block_buf = String::new();
        let mut in_list = false;
        let mut in_ordered_list = false;
        let mut in_blockquote = false;
        let mut paragraph_buf = String::new();

        let flush_paragraph = |buf: &mut String,
                                   out: &mut String,
                                   nodes: &mut Vec<StructureNode>,
                                   p_texts: &mut Vec<String>,
                                   offset: &mut usize| {
            if !buf.is_empty() {
                let p_idx = p_texts.len();
                let p_id = format!("p{}", p_idx);
                let text = buf.clone();
                let char_len = text.chars().count();
                let start_pos = DocumentPosition::new(0, *offset)
                    .with_node(&p_id)
                    .with_locator(&p_id);
                let end_pos = DocumentPosition::new(0, *offset + char_len)
                    .with_node(&p_id)
                    .with_locator(&p_id);

                let node = StructureNode::new(&p_id, NodeKind::Paragraph { index: p_idx })
                    .with_text(&text)
                    .with_range(DocumentRange::new(start_pos, end_pos));
                nodes.push(node);
                p_texts.push(text);
                *offset += char_len + 1;

                out.push_str(&format!("<p class=\"reader-paragraph\" id=\"{}\">", p_id));
                out.push_str(&render_inline(buf));
                out.push_str("</p>\n");
                buf.clear();
            }
        };

        for line in text_body.lines() {
            let trimmed = line.trim();

            if trimmed.starts_with("```") {
                flush_paragraph(
                    &mut paragraph_buf,
                    &mut html,
                    &mut structure_nodes,
                    &mut paragraph_texts,
                    &mut current_offset,
                );
                if in_code_block {
                    html.push_str("</code></pre>\n");
                    let c_id = format!("code-{}", structure_nodes.len());
                    let char_len = code_block_buf.chars().count();
                    let start_pos = DocumentPosition::new(0, current_offset)
                        .with_node(&c_id)
                        .with_locator(&c_id);
                    let end_pos = DocumentPosition::new(0, current_offset + char_len)
                        .with_node(&c_id)
                        .with_locator(&c_id);
                    structure_nodes.push(
                        StructureNode::new(
                            &c_id,
                            NodeKind::CodeBlock {
                                language: None,
                            },
                        )
                        .with_text(&code_block_buf)
                        .with_range(DocumentRange::new(start_pos, end_pos)),
                    );
                    current_offset += char_len + 1;
                    code_block_buf.clear();
                    in_code_block = false;
                } else {
                    if in_list {
                        html.push_str("</ul>\n");
                        in_list = false;
                    }
                    if in_ordered_list {
                        html.push_str("</ol>\n");
                        in_ordered_list = false;
                    }
                    if in_blockquote {
                        html.push_str("</blockquote>\n");
                        in_blockquote = false;
                    }
                    html.push_str("<pre class=\"bg-[#EFEAE1] dark:bg-[#1E1D1B] p-4 rounded-md overflow-x-auto text-sm font-mono\"><code>");
                    in_code_block = true;
                }
                continue;
            }

            if in_code_block {
                code_block_buf.push_str(line);
                code_block_buf.push('\n');
                for ch in line.chars() {
                    match ch {
                        '&' => html.push_str("&amp;"),
                        '<' => html.push_str("&lt;"),
                        '>' => html.push_str("&gt;"),
                        '"' => html.push_str("&quot;"),
                        _ => html.push(ch),
                    }
                }
                html.push('\n');
                continue;
            }

            // Blank line
            if trimmed.is_empty() {
                flush_paragraph(
                    &mut paragraph_buf,
                    &mut html,
                    &mut structure_nodes,
                    &mut paragraph_texts,
                    &mut current_offset,
                );
                if in_list {
                    html.push_str("</ul>\n");
                    in_list = false;
                }
                if in_ordered_list {
                    html.push_str("</ol>\n");
                    in_ordered_list = false;
                }
                if in_blockquote {
                    html.push_str("</blockquote>\n");
                    in_blockquote = false;
                }
                continue;
            }

            // Headings
            if let Some(h1_text) = trimmed.strip_prefix("# ") {
                flush_paragraph(
                    &mut paragraph_buf,
                    &mut html,
                    &mut structure_nodes,
                    &mut paragraph_texts,
                    &mut current_offset,
                );
                let id = format!("heading-{}", heading_count);
                heading_count += 1;
                let clean = h1_text.trim();
                let char_len = clean.chars().count();
                let start_pos = DocumentPosition::new(0, current_offset)
                    .with_node(&id)
                    .with_locator(&id);
                let end_pos = DocumentPosition::new(0, current_offset + char_len)
                    .with_node(&id)
                    .with_locator(&id);
                structure_nodes.push(
                    StructureNode::new(&id, NodeKind::Heading { level: 1 })
                        .with_text(clean)
                        .with_range(DocumentRange::new(start_pos, end_pos)),
                );
                current_offset += char_len + 1;
                if title.is_none() {
                    title = Some(clean.to_string());
                }
                toc.push(TocItem {
                    title: clean.to_string(),
                    locator: id.clone(),
                    play_order: Some(heading_count as u32),
                    children: Vec::new(),
                });
                html.push_str(&format!("<h1 id=\"{}\" class=\"text-3xl font-bold font-serif pt-6 pb-2 border-b border-[#E5DFD3]\">{}</h1>\n", id, render_inline(clean)));
                continue;
            }
            if let Some(h2_text) = trimmed.strip_prefix("## ") {
                flush_paragraph(
                    &mut paragraph_buf,
                    &mut html,
                    &mut structure_nodes,
                    &mut paragraph_texts,
                    &mut current_offset,
                );
                let id = format!("heading-{}", heading_count);
                heading_count += 1;
                let clean = h2_text.trim();
                let char_len = clean.chars().count();
                let start_pos = DocumentPosition::new(0, current_offset)
                    .with_node(&id)
                    .with_locator(&id);
                let end_pos = DocumentPosition::new(0, current_offset + char_len)
                    .with_node(&id)
                    .with_locator(&id);
                structure_nodes.push(
                    StructureNode::new(&id, NodeKind::Heading { level: 2 })
                        .with_text(clean)
                        .with_range(DocumentRange::new(start_pos, end_pos)),
                );
                current_offset += char_len + 1;
                toc.push(TocItem {
                    title: clean.to_string(),
                    locator: id.clone(),
                    play_order: Some(heading_count as u32),
                    children: Vec::new(),
                });
                html.push_str(&format!(
                    "<h2 id=\"{}\" class=\"text-2xl font-bold font-serif pt-4 pb-1\">{}</h2>\n",
                    id,
                    render_inline(clean)
                ));
                continue;
            }
            if let Some(h3_text) = trimmed.strip_prefix("### ") {
                flush_paragraph(
                    &mut paragraph_buf,
                    &mut html,
                    &mut structure_nodes,
                    &mut paragraph_texts,
                    &mut current_offset,
                );
                let id = format!("heading-{}", heading_count);
                heading_count += 1;
                let clean = h3_text.trim();
                let char_len = clean.chars().count();
                let start_pos = DocumentPosition::new(0, current_offset)
                    .with_node(&id)
                    .with_locator(&id);
                let end_pos = DocumentPosition::new(0, current_offset + char_len)
                    .with_node(&id)
                    .with_locator(&id);
                structure_nodes.push(
                    StructureNode::new(&id, NodeKind::Heading { level: 3 })
                        .with_text(clean)
                        .with_range(DocumentRange::new(start_pos, end_pos)),
                );
                current_offset += char_len + 1;
                html.push_str(&format!(
                    "<h3 id=\"{}\" class=\"text-xl font-semibold font-serif pt-3 pb-1\">{}</h3>\n",
                    id,
                    render_inline(clean)
                ));
                continue;
            }
            if let Some(h4_text) = trimmed.strip_prefix("#### ") {
                flush_paragraph(
                    &mut paragraph_buf,
                    &mut html,
                    &mut structure_nodes,
                    &mut paragraph_texts,
                    &mut current_offset,
                );
                let id = format!("heading-{}", heading_count);
                heading_count += 1;
                let clean = h4_text.trim();
                let char_len = clean.chars().count();
                let start_pos = DocumentPosition::new(0, current_offset)
                    .with_node(&id)
                    .with_locator(&id);
                let end_pos = DocumentPosition::new(0, current_offset + char_len)
                    .with_node(&id)
                    .with_locator(&id);
                structure_nodes.push(
                    StructureNode::new(&id, NodeKind::Heading { level: 4 })
                        .with_text(clean)
                        .with_range(DocumentRange::new(start_pos, end_pos)),
                );
                current_offset += char_len + 1;
                html.push_str(&format!(
                    "<h4 id=\"{}\" class=\"text-lg font-semibold font-serif pt-2\">{}</h4>\n",
                    id,
                    render_inline(clean)
                ));
                continue;
            }

            // Blockquote
            if let Some(quote_text) = trimmed.strip_prefix("> ") {
                flush_paragraph(
                    &mut paragraph_buf,
                    &mut html,
                    &mut structure_nodes,
                    &mut paragraph_texts,
                    &mut current_offset,
                );
                let clean = quote_text.trim();
                let b_id = format!("quote-{}", structure_nodes.len());
                let char_len = clean.chars().count();
                let start_pos = DocumentPosition::new(0, current_offset)
                    .with_node(&b_id)
                    .with_locator(&b_id);
                let end_pos = DocumentPosition::new(0, current_offset + char_len)
                    .with_node(&b_id)
                    .with_locator(&b_id);
                structure_nodes.push(
                    StructureNode::new(&b_id, NodeKind::Blockquote)
                        .with_text(clean)
                        .with_range(DocumentRange::new(start_pos, end_pos)),
                );
                current_offset += char_len + 1;

                if !in_blockquote {
                    html.push_str("<blockquote class=\"border-l-4 border-amber-500 pl-4 italic text-[#78716C] my-2\">\n");
                    in_blockquote = true;
                }
                html.push_str("<p>");
                html.push_str(&render_inline(clean));
                html.push_str("</p>\n");
                continue;
            }

            // Unordered List Item
            if trimmed.starts_with("* ") || trimmed.starts_with("- ") {
                flush_paragraph(
                    &mut paragraph_buf,
                    &mut html,
                    &mut structure_nodes,
                    &mut paragraph_texts,
                    &mut current_offset,
                );
                if in_ordered_list {
                    html.push_str("</ol>\n");
                    in_ordered_list = false;
                }
                if !in_list {
                    html.push_str("<ul class=\"list-disc list-inside space-y-1 my-2\">\n");
                    in_list = true;
                }
                let item_text = trimmed[2..].trim();
                let li_id = format!("li-{}", structure_nodes.len());
                let char_len = item_text.chars().count();
                let start_pos = DocumentPosition::new(0, current_offset)
                    .with_node(&li_id)
                    .with_locator(&li_id);
                let end_pos = DocumentPosition::new(0, current_offset + char_len)
                    .with_node(&li_id)
                    .with_locator(&li_id);
                structure_nodes.push(
                    StructureNode::new(&li_id, NodeKind::ListItem)
                        .with_text(item_text)
                        .with_range(DocumentRange::new(start_pos, end_pos)),
                );
                current_offset += char_len + 1;

                html.push_str(&format!("<li>{}</li>\n", render_inline(item_text)));
                continue;
            }

            // Ordered List Item
            if let Some(dot_pos) = trimmed.find(". ") {
                let num_part = &trimmed[..dot_pos];
                if num_part.chars().all(|c| c.is_ascii_digit()) {
                    flush_paragraph(
                        &mut paragraph_buf,
                        &mut html,
                        &mut structure_nodes,
                        &mut paragraph_texts,
                        &mut current_offset,
                    );
                    if in_list {
                        html.push_str("</ul>\n");
                        in_list = false;
                    }
                    if !in_ordered_list {
                        html.push_str("<ol class=\"list-decimal list-inside space-y-1 my-2\">\n");
                        in_ordered_list = true;
                    }
                    let item_text = trimmed[dot_pos + 2..].trim();
                    let li_id = format!("li-{}", structure_nodes.len());
                    let char_len = item_text.chars().count();
                    let start_pos = DocumentPosition::new(0, current_offset)
                        .with_node(&li_id)
                        .with_locator(&li_id);
                    let end_pos = DocumentPosition::new(0, current_offset + char_len)
                        .with_node(&li_id)
                        .with_locator(&li_id);
                    structure_nodes.push(
                        StructureNode::new(&li_id, NodeKind::ListItem)
                            .with_text(item_text)
                            .with_range(DocumentRange::new(start_pos, end_pos)),
                    );
                    current_offset += char_len + 1;

                    html.push_str(&format!("<li>{}</li>\n", render_inline(item_text)));
                    continue;
                }
            }

            // Regular paragraph line
            if !paragraph_buf.is_empty() {
                paragraph_buf.push(' ');
            }
            paragraph_buf.push_str(trimmed);
        }

        flush_paragraph(
            &mut paragraph_buf,
            &mut html,
            &mut structure_nodes,
            &mut paragraph_texts,
            &mut current_offset,
        );
        if in_code_block {
            html.push_str("</code></pre>\n");
        }
        if in_list {
            html.push_str("</ul>\n");
        }
        if in_ordered_list {
            html.push_str("</ol>\n");
        }
        if in_blockquote {
            html.push_str("</blockquote>\n");
        }
        html.push_str("</div>\n");

        if structure_nodes.is_empty() {
            let p_node = StructureNode::new("p0", NodeKind::Paragraph { index: 0 })
                .with_text("")
                .with_range(DocumentRange::new(
                    DocumentPosition::new(0, 0),
                    DocumentPosition::new(0, 0),
                ));
            structure_nodes.push(p_node);
            paragraph_texts.push(String::new());
        }

        // Sanitize output through luma_security
        let safe_html = sanitize_untrusted_html(&html);

        let final_title = title.unwrap_or(fallback_title);

        if toc.is_empty() {
            toc.push(TocItem {
                title: final_title.clone(),
                locator: "heading-0".to_string(),
                play_order: Some(1),
                children: Vec::new(),
            });
        }

        let root_node = StructureNode::new(
            "section-0",
            NodeKind::Section {
                index: 0,
                title: Some(final_title.clone()),
            },
        )
        .with_text(final_title.clone())
        .with_children(structure_nodes);

        let structure = DocumentStructure::new(root_node);

        Ok(Self {
            file_path: path_ref.to_path_buf(),
            title: final_title,
            raw_text,
            html_content: safe_html,
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
            id: "markdown_doc".to_string(),
            title: self.title.clone(),
            href: self
                .file_path
                .file_name()
                .map(|f| f.to_string_lossy().to_string())
                .unwrap_or_else(|| "document.md".to_string()),
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

            let snippet = format!("...{}...", &self.raw_text[safe_start..safe_end]);

            matches.push(DocumentSearchMatch {
                spine_index: 0,
                chapter_title: self.title.clone(),
                locator: format!("md:offset={}", actual_pos),
                snippet,
                match_char_offset: actual_pos,
            });

            if matches.len() >= 50 {
                break;
            }

            start_idx = actual_pos + q.len();
            if start_idx >= lower_text.len() {
                break;
            }
        }

        Ok(matches)
    }
}

/// Helper to render inline Markdown tags: `**bold**`, `*italic*`, `` `code` ``, `[text](url)`.
fn render_inline(text: &str) -> String {
    let mut out = String::with_capacity(text.len() * 2);
    let mut chars = text.chars().peekable();

    while let Some(ch) = chars.next() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '`' => {
                // Inline code
                let mut code_content = String::new();
                for inner in chars.by_ref() {
                    if inner == '`' {
                        break;
                    }
                    match inner {
                        '&' => code_content.push_str("&amp;"),
                        '<' => code_content.push_str("&lt;"),
                        '>' => code_content.push_str("&gt;"),
                        _ => code_content.push(inner),
                    }
                }
                out.push_str("<code class=\"bg-[#EFEAE1] dark:bg-[#2A2724] px-1.5 py-0.5 rounded text-sm font-mono\">");
                out.push_str(&code_content);
                out.push_str("</code>");
            }
            '*' => {
                if chars.peek() == Some(&'*') {
                    chars.next(); // consume second '*'
                    let mut bold_content = String::new();
                    let mut closed = false;
                    while let Some(b) = chars.next() {
                        if b == '*' && chars.peek() == Some(&'*') {
                            chars.next();
                            closed = true;
                            break;
                        }
                        bold_content.push(b);
                    }
                    if closed {
                        out.push_str("<strong>");
                        out.push_str(&render_inline(&bold_content));
                        out.push_str("</strong>");
                    } else {
                        out.push_str("**");
                        out.push_str(&bold_content);
                    }
                } else {
                    let mut italic_content = String::new();
                    let mut closed = false;
                    for it in chars.by_ref() {
                        if it == '*' {
                            closed = true;
                            break;
                        }
                        italic_content.push(it);
                    }
                    if closed {
                        out.push_str("<em>");
                        out.push_str(&render_inline(&italic_content));
                        out.push_str("</em>");
                    } else {
                        out.push('*');
                        out.push_str(&italic_content);
                    }
                }
            }
            '[' => {
                // Link: [text](url)
                let mut label = String::new();
                let mut closed = false;
                for l in chars.by_ref() {
                    if l == ']' {
                        closed = true;
                        break;
                    }
                    label.push(l);
                }
                if closed && chars.peek() == Some(&'(') {
                    chars.next(); // consume '('
                    let mut url = String::new();
                    let mut url_closed = false;
                    for u in chars.by_ref() {
                        if u == ')' {
                            url_closed = true;
                            break;
                        }
                        url.push(u);
                    }
                    if url_closed {
                        let trimmed_url = url.trim();
                        // Block dangerous protocols
                        if trimmed_url.to_lowercase().starts_with("javascript:")
                            || trimmed_url.to_lowercase().starts_with("data:")
                        {
                            out.push_str(&label);
                        } else {
                            out.push_str(&format!("<a href=\"{}\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"text-amber-600 underline\">{}</a>", trimmed_url, label));
                        }
                    } else {
                        out.push('[');
                        out.push_str(&label);
                        out.push_str("](");
                        out.push_str(&url);
                    }
                } else {
                    out.push('[');
                    out.push_str(&label);
                    if closed {
                        out.push(']');
                    }
                }
            }
            _ => out.push(ch),
        }
    }

    out
}
