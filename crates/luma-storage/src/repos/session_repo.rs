use chrono::{DateTime, Utc};
use rusqlite::params;
use serde::{Deserialize, Serialize};

use luma_core::ids::{BookId, DeviceId, SessionId};
use luma_core::models::reading::ReadingSession;

use crate::db::Database;
use crate::error::StorageResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyReadingMinutes {
    pub date: String,
    pub minutes: u32,
    pub intensity: u8, // 0-4 for heatmap
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadingSessionDetail {
    pub session_id: String,
    pub book_id: String,
    pub book_title: String,
    pub book_author: String,
    pub duration_seconds: u32,
    pub end_progress_pct: f32,
    pub ended_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadingAnalytics {
    pub total_reading_time_seconds: u64,
    pub weekly_reading_seconds: u64,
    pub books_completed_count: u32,
    pub daily_reading_minutes_last_28_days: Vec<DailyReadingMinutes>,
    pub recent_sessions: Vec<ReadingSessionDetail>,
    pub time_focus_data: Vec<u32>, // 6 points representing recent trend/activity
}

pub struct ReadingSessionRepository {
    db: Database,
}

impl ReadingSessionRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn insert(&self, session: &ReadingSession) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO reading_sessions (
                    id, book_id, device_id, started_at, ended_at,
                    duration_seconds, start_progress_pct, end_progress_pct
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                ON CONFLICT(id) DO UPDATE SET
                    ended_at = excluded.ended_at,
                    duration_seconds = excluded.duration_seconds,
                    end_progress_pct = excluded.end_progress_pct
                "#,
                params![
                    session.id.to_string(),
                    session.book_id.to_string(),
                    session.device_id.to_string(),
                    session.started_at.to_rfc3339(),
                    session.ended_at.map(|t| t.to_rfc3339()),
                    session.duration_seconds,
                    session.start_progress_pct,
                    session.end_progress_pct,
                ],
            )?;
            Ok(())
        })
    }

    pub fn complete_session(
        &self,
        session_id: &SessionId,
        end_progress: f32,
        duration_seconds: u32,
    ) -> StorageResult<()> {
        let now = Utc::now().to_rfc3339();
        self.db.with_conn(|conn| {
            conn.execute(
                r#"
                UPDATE reading_sessions
                SET ended_at = ?1,
                    duration_seconds = ?2,
                    end_progress_pct = ?3
                WHERE id = ?4
                "#,
                params![
                    now,
                    duration_seconds,
                    end_progress.clamp(0.0, 1.0),
                    session_id.to_string()
                ],
            )?;
            Ok(())
        })
    }

    pub fn get_by_id(&self, session_id: &SessionId) -> StorageResult<Option<ReadingSession>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, book_id, device_id, started_at, ended_at,
                       duration_seconds, start_progress_pct, end_progress_pct
                FROM reading_sessions
                WHERE id = ?1
                "#,
            )?;

            let mut rows = stmt.query(params![session_id.to_string()])?;
            if let Some(row) = rows.next()? {
                let id_str: String = row.get(0)?;
                let book_id_str: String = row.get(1)?;
                let dev_id_str: String = row.get(2)?;
                let started_str: String = row.get(3)?;
                let ended_str: Option<String> = row.get(4)?;
                let duration_seconds: u32 = row.get(5)?;
                let start_progress: f32 = row.get(6)?;
                let end_progress: f32 = row.get(7)?;

                let started_at = DateTime::parse_from_rfc3339(&started_str)
                    .map(|d| d.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now());
                let ended_at = ended_str.and_then(|s| {
                    DateTime::parse_from_rfc3339(&s)
                        .map(|d| d.with_timezone(&Utc))
                        .ok()
                });

                Ok(Some(ReadingSession {
                    id: id_str.parse().unwrap_or_else(|_| SessionId::new()),
                    book_id: book_id_str.parse().unwrap_or_else(|_| BookId::new()),
                    device_id: dev_id_str.parse().unwrap_or_else(|_| DeviceId::new()),
                    started_at,
                    ended_at,
                    duration_seconds,
                    start_progress_pct: start_progress,
                    end_progress_pct: end_progress,
                }))
            } else {
                Ok(None)
            }
        })
    }

    pub fn list_by_book(&self, book_id: &BookId) -> StorageResult<Vec<ReadingSession>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, book_id, device_id, started_at, ended_at,
                       duration_seconds, start_progress_pct, end_progress_pct
                FROM reading_sessions
                WHERE book_id = ?1
                ORDER BY started_at DESC
                "#,
            )?;

            let rows = stmt.query_map(params![book_id.to_string()], |row| {
                let id_str: String = row.get(0)?;
                let b_id_str: String = row.get(1)?;
                let d_id_str: String = row.get(2)?;
                let s_str: String = row.get(3)?;
                let e_str: Option<String> = row.get(4)?;
                let dur: u32 = row.get(5)?;
                let start_p: f32 = row.get(6)?;
                let end_p: f32 = row.get(7)?;

                let started_at = DateTime::parse_from_rfc3339(&s_str)
                    .map(|d| d.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now());
                let ended_at = e_str.and_then(|s| {
                    DateTime::parse_from_rfc3339(&s)
                        .map(|d| d.with_timezone(&Utc))
                        .ok()
                });

                Ok(ReadingSession {
                    id: id_str.parse().unwrap_or_else(|_| SessionId::new()),
                    book_id: b_id_str.parse().unwrap_or_else(|_| BookId::new()),
                    device_id: d_id_str.parse().unwrap_or_else(|_| DeviceId::new()),
                    started_at,
                    ended_at,
                    duration_seconds: dur,
                    start_progress_pct: start_p,
                    end_progress_pct: end_p,
                })
            })?;

            let mut sessions = Vec::new();
            for r in rows {
                sessions.push(r?);
            }
            Ok(sessions)
        })
    }

    pub fn get_analytics(&self) -> StorageResult<ReadingAnalytics> {
        self.db.with_read_conn(|conn| {
            // 1. Total reading time
            let total_reading_time_seconds: u64 = conn
                .query_row(
                    "SELECT COALESCE(SUM(duration_seconds), 0) FROM reading_sessions",
                    [],
                    |r| r.get(0),
                )
                .unwrap_or(0);

            // 2. Weekly reading time (last 7 days)
            let weekly_reading_seconds: u64 = conn
                .query_row(
                    "SELECT COALESCE(SUM(duration_seconds), 0) FROM reading_sessions WHERE started_at >= datetime('now', '-7 days')",
                    [],
                    |r| r.get(0),
                )
                .unwrap_or(0);

            // 3. Books completed count
            let books_completed_count: u32 = conn
                .query_row(
                    "SELECT COUNT(*) FROM books WHERE reading_status = 'completed'",
                    [],
                    |r| r.get(0),
                )
                .unwrap_or(0);

            // 4. Daily reading minutes for last 28 days (4 weeks)
            let mut daily_stats: Vec<DailyReadingMinutes> = Vec::with_capacity(28);
            let today = Utc::now().date_naive();

            let mut stmt = conn.prepare(
                r#"
                SELECT substr(started_at, 1, 10) as day, COALESCE(SUM(duration_seconds), 0) / 60 as mins
                FROM reading_sessions
                WHERE started_at >= datetime('now', '-28 days')
                GROUP BY day
                "#,
            )?;
            let mut day_map = std::collections::HashMap::new();
            let rows = stmt.query_map([], |r| {
                let day: String = r.get(0)?;
                let mins: i64 = r.get(1)?;
                Ok((day, mins as u32))
            })?;
            for r in rows {
                let (d, m) = r?;
                day_map.insert(d, m);
            }

            for i in (0..28).rev() {
                let d = today - chrono::Duration::days(i);
                let d_str = d.format("%Y-%m-%d").to_string();
                let mins = day_map.get(&d_str).copied().unwrap_or(0);
                let intensity = match mins {
                    0 => 0,
                    1..=15 => 1,
                    16..=30 => 2,
                    31..=60 => 3,
                    _ => 4,
                };
                daily_stats.push(DailyReadingMinutes {
                    date: d_str,
                    minutes: mins,
                    intensity,
                });
            }

            // 5. Recent sessions with book title and author
            let mut stmt = conn.prepare(
                r#"
                SELECT s.id, s.book_id, b.title,
                       COALESCE((SELECT a.name FROM book_authors ba JOIN authors a ON ba.author_id = a.id WHERE ba.book_id = b.id LIMIT 1), 'Unknown Author') as author_name,
                       s.duration_seconds, s.end_progress_pct, COALESCE(s.ended_at, s.started_at)
                FROM reading_sessions s
                JOIN books b ON s.book_id = b.id
                ORDER BY s.started_at DESC
                LIMIT 5
                "#,
            )?;
            let session_rows = stmt.query_map([], |r| {
                Ok(ReadingSessionDetail {
                    session_id: r.get(0)?,
                    book_id: r.get(1)?,
                    book_title: r.get(2)?,
                    book_author: r.get(3)?,
                    duration_seconds: r.get(4)?,
                    end_progress_pct: r.get(5)?,
                    ended_at: r.get(6)?,
                })
            })?;

            let mut recent_sessions = Vec::new();
            for sr in session_rows {
                recent_sessions.push(sr?);
            }

            // 6. Time focus trend data (last 6 days reading minutes)
            let mut time_focus_data = Vec::new();
            let recent_slice = if daily_stats.len() >= 6 {
                &daily_stats[daily_stats.len() - 6..]
            } else {
                &daily_stats[..]
            };
            for day in recent_slice {
                time_focus_data.push(day.minutes);
            }

            Ok(ReadingAnalytics {
                total_reading_time_seconds,
                weekly_reading_seconds,
                books_completed_count,
                daily_reading_minutes_last_28_days: daily_stats,
                recent_sessions,
                time_focus_data,
            })
        })
    }

    pub fn list_all(&self) -> StorageResult<Vec<ReadingSession>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, book_id, device_id, started_at, ended_at,
                       duration_seconds, start_progress_pct, end_progress_pct
                FROM reading_sessions
                ORDER BY started_at DESC
                "#,
            )?;

            let rows = stmt.query_map([], |row| {
                let id_str: String = row.get(0)?;
                let b_id_str: String = row.get(1)?;
                let d_id_str: String = row.get(2)?;
                let s_str: String = row.get(3)?;
                let e_str: Option<String> = row.get(4)?;
                let dur: u32 = row.get(5)?;
                let start_p: f32 = row.get(6)?;
                let end_p: f32 = row.get(7)?;

                let started_at = DateTime::parse_from_rfc3339(&s_str)
                    .map(|d| d.with_timezone(&Utc))
                    .unwrap_or_else(|_| Utc::now());
                let ended_at = e_str.and_then(|s| {
                    DateTime::parse_from_rfc3339(&s)
                        .map(|d| d.with_timezone(&Utc))
                        .ok()
                });

                Ok(ReadingSession {
                    id: id_str.parse().unwrap_or_else(|_| SessionId::new()),
                    book_id: b_id_str.parse().unwrap_or_else(|_| BookId::new()),
                    device_id: d_id_str.parse().unwrap_or_else(|_| DeviceId::new()),
                    started_at,
                    ended_at,
                    duration_seconds: dur,
                    start_progress_pct: start_p,
                    end_progress_pct: end_p,
                })
            })?;

            let mut sessions = Vec::new();
            for r in rows {
                sessions.push(r?);
            }
            Ok(sessions)
        })
    }
}
