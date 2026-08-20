use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const PROTOCOL_NAME: &str = "eskusmi";
pub const PROTOCOL_VERSION: u32 = 1;
pub const UDP_DISCOVERY_PORT: u16 = 38555;
pub const HEARTBEAT_INTERVAL_MS: u64 = 5_000;
pub const PEER_TIMEOUT_MS: u64 = 15_000;
pub const PING_EXPIRE_MS: u64 = 60_000;
pub const PING_CONNECT_TIMEOUT_MS: u64 = 4_000;
pub const PING_ACK_TIMEOUT_MS: u64 = 8_000;
pub const PING_RATE_LIMIT_MS: u64 = 3_000;
pub const PING_ID_CACHE_TTL_MS: u64 = 120_000;
pub const MAX_NAME_LEN: usize = 64;
pub const MAX_TCP_MESSAGE_BYTES: usize = 8_192;
/// Soft clock skew window for replay-ish checks (not authentication).
pub const TIMESTAMP_MAX_SKEW_MS: u64 = 24 * 60 * 60 * 1_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PresenceStatus {
    Available,
    Focus,
    Away,
    Busy,
}

impl PresenceStatus {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "available" => Some(Self::Available),
            "focus" => Some(Self::Focus),
            "away" => Some(Self::Away),
            "busy" => Some(Self::Busy),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Available => "available",
            Self::Focus => "focus",
            Self::Away => "away",
            Self::Busy => "busy",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresencePacket {
    pub protocol: String,
    pub version: u32,
    #[serde(rename = "type")]
    pub kind: String,
    pub id: String,
    pub name: String,
    pub status: String,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PingMessage {
    pub protocol: String,
    pub version: u32,
    #[serde(rename = "type")]
    pub kind: String,
    pub id: String,
    #[serde(rename = "senderId")]
    pub sender_id: String,
    #[serde(rename = "senderName")]
    pub sender_name: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PingAckMessage {
    pub protocol: String,
    pub version: u32,
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(rename = "pingId")]
    pub ping_id: String,
    #[serde(rename = "senderId")]
    pub sender_id: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum TcpEnvelope {
    Ping(PingMessage),
    Ack(PingAckMessage),
}

pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn is_valid_peer_id(id: &str) -> bool {
    let id = id.trim();
    if id.is_empty() || id.len() > 36 {
        return false;
    }
    Uuid::parse_str(id).is_ok()
}

pub fn is_valid_display_name(name: &str) -> bool {
    let trimmed = name.trim();
    !trimmed.is_empty() && trimmed.chars().count() <= MAX_NAME_LEN
}

/// Accept timestamps within a wide window so mild clock drift is fine.
pub fn is_reasonable_timestamp(timestamp: u64) -> bool {
    if timestamp == 0 {
        return false;
    }
    let now = now_ms();
    let skew = now.abs_diff(timestamp);
    skew <= TIMESTAMP_MAX_SKEW_MS
}

pub fn build_presence(id: &str, name: &str, status: &PresenceStatus, port: u16) -> PresencePacket {
    PresencePacket {
        protocol: PROTOCOL_NAME.to_string(),
        version: PROTOCOL_VERSION,
        kind: "presence".to_string(),
        id: id.to_string(),
        name: name.to_string(),
        status: status.as_str().to_string(),
        port,
    }
}

pub fn parse_presence(bytes: &[u8]) -> Option<PresencePacket> {
    if bytes.len() > MAX_TCP_MESSAGE_BYTES {
        return None;
    }

    let packet: PresencePacket = serde_json::from_slice(bytes).ok()?;
    if packet.protocol != PROTOCOL_NAME || packet.version != PROTOCOL_VERSION {
        return None;
    }
    if packet.kind != "presence" {
        return None;
    }
    if !is_valid_peer_id(&packet.id) || !is_valid_display_name(&packet.name) {
        return None;
    }
    if PresenceStatus::parse(&packet.status).is_none() {
        return None;
    }
    if packet.port == 0 {
        return None;
    }
    Some(packet)
}

pub fn build_ping(id: &str, sender_id: &str, sender_name: &str) -> PingMessage {
    PingMessage {
        protocol: PROTOCOL_NAME.to_string(),
        version: PROTOCOL_VERSION,
        kind: "ping".to_string(),
        id: id.to_string(),
        sender_id: sender_id.to_string(),
        sender_name: sender_name.to_string(),
        timestamp: now_ms(),
    }
}

pub fn build_ping_ack(ping_id: &str, sender_id: &str) -> PingAckMessage {
    PingAckMessage {
        protocol: PROTOCOL_NAME.to_string(),
        version: PROTOCOL_VERSION,
        kind: "ping_ack".to_string(),
        ping_id: ping_id.to_string(),
        sender_id: sender_id.to_string(),
        timestamp: now_ms(),
    }
}

pub fn parse_tcp_message(line: &str) -> Option<TcpEnvelope> {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.len() > MAX_TCP_MESSAGE_BYTES {
        return None;
    }

    let value: serde_json::Value = serde_json::from_str(trimmed).ok()?;
    let protocol = value.get("protocol")?.as_str()?;
    let version = value.get("version")?.as_u64()?;
    let kind = value.get("type")?.as_str()?;

    if protocol != PROTOCOL_NAME || version != PROTOCOL_VERSION as u64 {
        return None;
    }

    match kind {
        "ping" => {
            let msg: PingMessage = serde_json::from_value(value).ok()?;
            if !is_valid_peer_id(&msg.id)
                || !is_valid_peer_id(&msg.sender_id)
                || !is_valid_display_name(&msg.sender_name)
            {
                return None;
            }
            if !is_reasonable_timestamp(msg.timestamp) {
                return None;
            }
            Some(TcpEnvelope::Ping(msg))
        }
        "ping_ack" => {
            let msg: PingAckMessage = serde_json::from_value(value).ok()?;
            if !is_valid_peer_id(&msg.ping_id) || !is_valid_peer_id(&msg.sender_id) {
                return None;
            }
            if !is_reasonable_timestamp(msg.timestamp) {
                return None;
            }
            Some(TcpEnvelope::Ack(msg))
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_wrong_protocol_presence() {
        let raw = br#"{"protocol":"nope","version":1,"type":"presence","id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","name":"A","status":"available","port":1}"#;
        assert!(parse_presence(raw).is_none());
    }

    #[test]
    fn rejects_invalid_id_presence() {
        let raw = br#"{"protocol":"eskusmi","version":1,"type":"presence","id":"not-a-uuid","name":"A","status":"available","port":1}"#;
        assert!(parse_presence(raw).is_none());
    }

    #[test]
    fn rejects_long_name() {
        let name = "x".repeat(65);
        let raw = format!(
            r#"{{"protocol":"eskusmi","version":1,"type":"presence","id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","name":"{name}","status":"available","port":1}}"#
        );
        assert!(parse_presence(raw.as_bytes()).is_none());
    }

    #[test]
    fn parses_valid_presence() {
        let packet = build_presence(
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            "Shibu",
            &PresenceStatus::Focus,
            4000,
        );
        let bytes = serde_json::to_vec(&packet).unwrap();
        let parsed = parse_presence(&bytes).unwrap();
        assert_eq!(parsed.id, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
        assert_eq!(parsed.status, "focus");
    }

    #[test]
    fn parses_ping_and_ack() {
        let ping = build_ping(
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            "Aishwarya",
        );
        let line = serde_json::to_string(&ping).unwrap();
        match parse_tcp_message(&line).unwrap() {
            TcpEnvelope::Ping(msg) => assert_eq!(msg.sender_name, "Aishwarya"),
            _ => panic!("expected ping"),
        }

        let ack = build_ping_ack(
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        );
        let line = serde_json::to_string(&ack).unwrap();
        match parse_tcp_message(&line).unwrap() {
            TcpEnvelope::Ack(msg) => {
                assert_eq!(msg.ping_id, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
            }
            _ => panic!("expected ack"),
        }
    }

    #[test]
    fn rejects_oversized_tcp_payload() {
        let huge = "a".repeat(MAX_TCP_MESSAGE_BYTES + 10);
        assert!(parse_tcp_message(&huge).is_none());
    }
}
